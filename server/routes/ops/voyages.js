// Voyages (features B1–B10, C3, C6, D3–D5). Port calls: routes/ops/portCalls.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const Vessel = require('../../models/ops/Vessel');
const Counter = require('../../models/ops/Counter');
const VoyageTask = require('../../models/ops/VoyageTask');
const DateRevision = require('../../models/ops/DateRevision');
const VoyageLog = require('../../models/ops/VoyageLog');
const access = require('../../services/ops/accessScope');
const taskEngine = require('../../services/ops/taskEngine');
const engine = require('../../services/ops/dueDateEngine');
const { applySuggestions, manualFlagsFromInput } = require('../../services/ops/suggestions');
const { effectiveVesselStatus } = require('../../services/ops/vesselStatus');
const { normaliseVoyage, normalisePortCall, assertPortCallOrder, badRequest } = require('../../services/ops/voyageInput');
const { OFFICE_TZ } = require('../../services/ops/config');
const { VESSEL_STATUS_VALUES } = require('../../services/ops/constants');
const { sendError, escapeRegex, httpError } = require('./helpers');
const { VOYAGE_STATUSES } = Voyage;

const CLIENT = 'companyName clientType email phone';
const EMPLOYEE = 'employeeName emailId profilePhoto employeeStatus';

// Status changes allowed through PUT. DRAFT → ACTIVE only through /activate.
const STATUS_MOVES = {
  DRAFT: ['CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ACTIVE'],
  CANCELLED: ['DRAFT'],
};

// Voyage-level key dates that drive due dates; changes on an active voyage are logged (C3)
const KEY_FIELDS = [
  ['fixture', 'cargoFixedAt'], ['fixture', 'vesselFixedAt'],
  ['delivery', 'estimated'], ['delivery', 'actual'],
  ['redelivery', 'estimated'], ['redelivery', 'actual'],
  ['bunker', 'bookedOn'], ['bunker', 'bunkeringDate'],
];
const timeOf = (d) => (d ? new Date(d).getTime() : null);

// Mongo filters are fine with id strings; aggregation needs real ObjectIds
function toObjectIds(filter) {
  const conv = (v) => (typeof v === 'string' && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v);
  if (filter._id === null) return { _id: null };
  if (filter.$or) {
    return { $or: filter.$or.map((c) => (c.operators ? { operators: conv(c.operators) } : { _id: { $in: c._id.$in.map(conv) } })) };
  }
  if (filter.operators) return { operators: conv(filter.operators) };
  return {};
}

async function nextVoyageNo() {
  const year = DateTime.now().setZone(OFFICE_TZ).year;
  const n = await Counter.next(`voyage-${year}`);
  return `VOY-${year}-${String(n).padStart(4, '0')}`;
}

// Load a voyage the user may see (404 otherwise, so ids of hidden voyages are not revealed)
async function loadVisible(req, id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, 'Voyage not found');
  const voyage = await Voyage.findById(id);
  if (!voyage || !(await access.canView(req.user, voyage))) throw httpError(404, 'Voyage not found');
  return voyage;
}

async function loadEditable(req, id) {
  const voyage = await loadVisible(req, id);
  if (!(await access.canEdit(req.user, voyage))) throw httpError(403, 'You cannot edit this voyage');
  return voyage;
}

// Counts of the voyage's tasks by bucket and status (for the details view and the report)
async function taskSummary(voyageId) {
  const tasks = await VoyageTask.find({ voyage: voyageId }).select('status dueDate startDate completedDate').lean();
  const today = engine.todayIn();
  const summary = { total: tasks.length, byStatus: {}, byBucket: {} };
  for (const t of tasks) {
    const d = engine.derive(t, today);
    summary.byStatus[t.status] = (summary.byStatus[t.status] || 0) + 1;
    summary.byBucket[d.bucket] = (summary.byBucket[d.bucket] || 0) + 1;
  }
  return summary;
}

async function populatedVoyage(id, user) {
  const voyage = await Voyage.findById(id)
    .populate('vessel', 'name imo type dwt flag yearBuilt isActive')
    .populate('charterers', CLIENT)
    .populate('owners', CLIENT)
    .populate('brokers', CLIENT)
    .populate('operators', EMPLOYEE)
    .populate('bunker.supplier', CLIENT)
    .populate('delivery.port', 'name country timeZone')
    .populate('redelivery.port', 'name country timeZone')
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username')
    .lean();
  const portCalls = await PortCall.find({ voyage: id })
    .populate('port', 'name country unlocode timeZone')
    .populate('agent', CLIENT)
    .sort({ seq: 1 })
    .lean();
  return {
    ...voyage,
    portCalls,
    vesselStatusShown: effectiveVesselStatus(voyage, portCalls),
    tasks: voyage.status === 'DRAFT' ? null : await taskSummary(id),
    permissions: await access.permissionsFor(user, voyage),
  };
}

// Operators are always added to the operators of a voyage they create
function withCreatorAsOperator(user, operators) {
  const emp = access.employeeIdOf(user);
  if (user.role === 'operations_executive' || user.role === 'executive_post_fixture') {
    if (!emp) throw badRequest('Your login is not linked to an employee. Ask an admin to link it in User Management (“Select Employee”).');
    return [...new Set([...(operators || []), emp])];
  }
  return operators || [];
}

// Tell open voyage workspaces that dates moved (step 6 listens for it)
function emitDatesChanged(req, voyageId, result) {
  const io = req.app.get('io');
  if (io && result && result.movedTasks && result.movedTasks.length) {
    io.to(`voyage-${voyageId}`).emit('ops-dates-changed', { voyageId: String(voyageId), moved: result.movedTasks.length, dueSoon: result.dueSoon.length });
  }
}

// Tell open workspaces that the voyage changed (they refetch; the author's own page ignores it)
function emitVoyageUpdated(req, voyageId, what) {
  const io = req.app.get('io');
  if (io) io.to(`voyage-${voyageId}`).emit('ops-voyage-updated', { voyageId: String(voyageId), what, by: String(req.user._id), byName: req.user.username });
}

const STATUS_WORD = { DRAFT: 'draft', ACTIVE: 'active', COMPLETED: 'completed', CANCELLED: 'cancelled' };

// ------------------------------------------------------------------ list
router.get('/', async (req, res) => {
  try {
    const scope = await access.voyageFilter(req.user);
    const filter = { $and: [scope] };
    const { status, vesselStatus, vessel, operator, search } = req.query;
    if (status && status !== 'ALL') {
      if (!VOYAGE_STATUSES.includes(status)) throw badRequest(`status must be one of ${VOYAGE_STATUSES.join(', ')} or ALL`);
      filter.$and.push({ status });
    }
    if (vesselStatus) filter.$and.push({ vesselStatus });
    if (vessel) filter.$and.push({ vessel });
    if (operator) filter.$and.push({ operators: operator });
    if (search) {
      const rx = { $regex: escapeRegex(search.trim()), $options: 'i' };
      const vesselIds = await Vessel.find({ name: rx }).distinct('_id');
      filter.$and.push({ $or: [{ voyageNo: rx }, { vessel: { $in: vesselIds } }] });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [items, total, byStatus] = await Promise.all([
      Voyage.find(filter)
        .select('voyageNo status voyageType vesselStatus vesselStatusOverride vessel charterers operators delivery redelivery updatedAt createdAt')
        .populate('vessel', 'name')
        .populate('charterers', 'companyName')
        .populate('operators', 'employeeName')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Voyage.countDocuments(filter),
      Voyage.aggregate([{ $match: toObjectIds(scope) }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);

    const ids = items.map((v) => v._id);
    const calls = await PortCall.find({ voyage: { $in: ids } })
      .select('voyage seq type status planned.eta actual.ata actual.atd timeZone port')
      .populate('port', 'name')
      .sort({ seq: 1 })
      .lean();
    const rotation = new Map();
    for (const c of calls) {
      const key = String(c.voyage);
      if (!rotation.has(key)) rotation.set(key, []);
      rotation.get(key).push({ _id: c._id, seq: c.seq, type: c.type, status: c.status, port: c.port?.name, eta: c.planned?.eta, ata: c.actual?.ata, atd: c.actual?.atd, timeZone: c.timeZone });
    }

    // Open-task counts per voyage (overdue / due today) for active voyages
    const today = engine.todayIn();
    const taskCounts = await VoyageTask.aggregate([
      { $match: { voyage: { $in: ids }, status: { $in: taskEngine.OPEN }, dueDate: { $ne: null, $lte: today } } },
      { $group: { _id: '$voyage', overdue: { $sum: { $cond: [{ $lt: ['$dueDate', today] }, 1, 0] } }, today: { $sum: { $cond: [{ $eq: ['$dueDate', today] }, 1, 0] } } } },
    ]);
    const countsById = new Map(taskCounts.map((c) => [String(c._id), { overdue: c.overdue, today: c.today }]));

    const counts = Object.fromEntries(VOYAGE_STATUSES.map((s) => [s, 0]));
    byStatus.forEach((r) => { counts[r._id] = r.n; });
    counts.ALL = Object.values(counts).reduce((a, b) => a + b, 0);

    const out = [];
    for (const v of items) {
      out.push({
        ...v,
        vesselStatusShown: v.vesselStatusOverride?.value || v.vesselStatus,
        rotation: rotation.get(String(v._id)) || [],
        taskCounts: countsById.get(String(v._id)) || { overdue: 0, today: 0 },
        permissions: await access.permissionsFor(req.user, v),
      });
    }
    res.json({ items: out, total, page, limit, counts, canCreate: access.canCreate(req.user) });
  } catch (err) { sendError(res, err, 'Error fetching voyages'); }
});

// ------------------------------------------------------------------ create (DRAFT, with port calls)
router.post('/', async (req, res) => {
  let voyage = null;
  try {
    if (!access.canCreate(req.user)) throw httpError(403, 'You cannot create voyages');
    const data = await normaliseVoyage(req.body, null);
    data.operators = withCreatorAsOperator(req.user, data.operators);
    if (!data.operators.length) throw badRequest('Choose at least one operator');

    const portInputs = Array.isArray(req.body.portCalls) ? req.body.portCalls : [];
    const portCalls = [];
    for (const [i, input] of portInputs.entries()) {
      const pc = await normalisePortCall(input, null, i);
      pc.manual = manualFlagsFromInput(input, null);
      applySuggestions(pc);
      assertPortCallOrder(pc, `Port call ${i + 1}`);
      portCalls.push(pc);
    }

    const bunkerIndex = req.body.bunker && Number.isInteger(req.body.bunker.portCallIndex) ? req.body.bunker.portCallIndex : null;
    if (bunkerIndex !== null && (!portCalls[bunkerIndex] || portCalls[bunkerIndex].type !== 'BUNKERING')) {
      throw badRequest('bunker.portCallIndex must point to a BUNKERING port call');
    }
    if (data.bunker) data.bunker.portCall = null;

    voyage = await Voyage.create({ ...data, voyageNo: await nextVoyageNo(), status: 'DRAFT', createdBy: req.user._id, updatedBy: req.user._id });
    const created = await PortCall.insertMany(portCalls.map((pc, i) => ({ ...pc, voyage: voyage._id, seq: i + 1, updatedBy: req.user._id })));
    if (bunkerIndex !== null) {
      voyage.bunker.portCall = created[bunkerIndex]._id;
      await voyage.save();
    }
    await VoyageLog.write(voyage._id, req.user, 'CREATED', `Draft ${voyage.voyageNo} created`);
    res.status(201).json(await populatedVoyage(voyage._id, req.user));
  } catch (err) {
    if (voyage) {
      await PortCall.deleteMany({ voyage: voyage._id }).catch(() => {});
      await Voyage.deleteOne({ _id: voyage._id }).catch(() => {});
    }
    sendError(res, err, 'Error creating voyage');
  }
});

// ------------------------------------------------------------------ read
router.get('/:id', async (req, res) => {
  try {
    await loadVisible(req, req.params.id);
    res.json(await populatedVoyage(req.params.id, req.user));
  } catch (err) { sendError(res, err, 'Error fetching voyage'); }
});

// ------------------------------------------------------------------ update (recalculates due dates on an active voyage)
router.put('/:id', async (req, res) => {
  try {
    const current = await loadEditable(req, req.params.id);
    const wantsStatus = req.body.status && req.body.status !== current.status;
    if (wantsStatus) {
      const to = req.body.status;
      if (to === 'ACTIVE' && current.status === 'DRAFT') throw badRequest('A draft becomes Active through “Activate” (task generation), not by editing its status');
      if (!(STATUS_MOVES[current.status] || []).includes(to)) throw badRequest(`A ${current.status.toLowerCase()} voyage cannot be changed to ${String(to).toLowerCase()}`);
    }
    const editable = Object.keys(req.body).filter((k) => !['status', 'reason'].includes(k));
    if (editable.length && !['DRAFT', 'ACTIVE'].includes(current.status)) {
      throw badRequest(`A ${current.status.toLowerCase()} voyage cannot be edited. Re-open it first.`);
    }
    const data = await normaliseVoyage(req.body, current.toObject());
    if (data.operators && !data.operators.length) throw badRequest('A voyage needs at least one operator');
    if (data.bunker && data.bunker.portCall) {
      const pc = await PortCall.findOne({ _id: data.bunker.portCall, voyage: current._id });
      if (!pc || pc.type !== 'BUNKERING') throw badRequest('The bunkering port call must be a BUNKERING call of this voyage');
    }

    const result = await taskEngine.withTransaction(async (session) => {
      const voyage = await Voyage.findById(current._id).session(session);
      const before = voyage.toObject();
      Object.assign(voyage, data, { updatedBy: req.user._id });
      if (wantsStatus) voyage.status = req.body.status;
      const changed = KEY_FIELDS.filter(([g, k]) => timeOf(before[g] && before[g][k]) !== timeOf(voyage[g] && voyage[g][k]));
      if (changed.some(([g, k]) => k === 'actual')) voyage.vesselStatusOverride = { value: null, setBy: null, setAt: null };
      await voyage.save({ session });
      if (voyage.status !== 'ACTIVE') return { movedTasks: [], dueSoon: [] };

      const recalc = await taskEngine.recalculate(voyage._id, { session, user: req.user, reason: req.body.reason });
      await taskEngine.refreshVesselStatus(voyage._id, { session });
      if (changed.length) {
        await DateRevision.insertMany(changed.map(([g, k]) => ({
          voyage: voyage._id, field: `${g}.${k}`, from: before[g] && before[g][k], to: voyage[g][k],
          by: req.user._id, reason: req.body.reason || '', tasksMoved: recalc.movedTasks.length,
        })), { session });
      }
      recalc.autoCompleted = await taskEngine.autoCompleteLinked(voyage._id,
        changed.filter(([g, k]) => voyage[g] && voyage[g][k]).map(([g, k]) => ({ field: `${g}.${k}`, portCall: null })), { session, user: req.user });
      return recalc;
    });
    if (wantsStatus) {
      await VoyageLog.write(current._id, req.user, 'STATUS', `Voyage ${STATUS_WORD[current.status]} → ${STATUS_WORD[req.body.status]}${req.body.reason ? ` (${req.body.reason})` : ''}`);
    }
    emitDatesChanged(req, current._id, result);
    emitVoyageUpdated(req, current._id, wantsStatus ? 'status' : 'voyage');
    res.json({ ...(await populatedVoyage(current._id, req.user)), movedTasks: result.movedTasks, dueSoon: result.dueSoon, autoCompleted: result.autoCompleted || 0 });
  } catch (err) { sendError(res, err, 'Error updating voyage'); }
});

// ------------------------------------------------------------------ delete (drafts only)
router.delete('/:id', async (req, res) => {
  try {
    const voyage = await loadVisible(req, req.params.id);
    if (!access.canDelete(req.user, voyage)) {
      throw httpError(voyage.status !== 'DRAFT' ? 400 : 403, voyage.status !== 'DRAFT'
        ? 'Only draft voyages can be deleted. Cancel the voyage instead.'
        : 'Only an admin or manager can delete a draft voyage');
    }
    await PortCall.deleteMany({ voyage: voyage._id });
    await VoyageTask.deleteMany({ voyage: voyage._id });
    await voyage.deleteOne();
    res.json({ message: `Voyage ${voyage.voyageNo} deleted` });
  } catch (err) { sendError(res, err, 'Error deleting voyage'); }
});

// ------------------------------------------------------------------ copy (B10): structure only, no dates or actuals
router.post('/:id/clone', async (req, res) => {
  let copy = null;
  try {
    const source = await loadVisible(req, req.params.id);
    if (!access.canCreate(req.user)) throw httpError(403, 'You cannot create voyages');
    const src = source.toObject();
    const vessel = await Vessel.findById(src.vessel).select('isActive name').lean();
    if (!vessel || !vessel.isActive) throw badRequest('The vessel of this voyage is no longer active; choose another vessel on a new voyage');

    const handover = (h) => ({ place: h?.place || '', port: h?.port || null, timeZone: h?.timeZone || OFFICE_TZ, estimated: null, original: null, actual: null });
    copy = await Voyage.create({
      voyageNo: await nextVoyageNo(),
      status: 'DRAFT',
      voyageType: src.voyageType,
      vessel: src.vessel,
      master: src.master,
      charterers: src.charterers,
      owners: src.owners,
      brokers: src.brokers,
      operators: withCreatorAsOperator(req.user, (src.operators || []).map(String)),
      fixture: {},
      cargo: (src.cargo || []).map(({ _id, ...c }) => c),
      delivery: handover(src.delivery),
      redelivery: handover(src.redelivery),
      bunker: { supplier: src.bunker?.supplier || null, grade: src.bunker?.grade || '', quantity: src.bunker?.quantity ?? null },
      copiedFrom: source._id,
      remarks: `Copied from ${source.voyageNo}`,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const calls = await PortCall.find({ voyage: source._id, status: 'ACTIVE' }).sort({ seq: 1 }).lean();
    const created = await PortCall.insertMany(calls.map((c, i) => ({
      voyage: copy._id, seq: i + 1, port: c.port, timeZone: c.timeZone, type: c.type, agent: c.agent,
      cargoQty: c.cargoQty, ratePerDay: c.ratePerDay, remarks: c.remarks, updatedBy: req.user._id,
    })));
    if (src.bunker?.portCall) {
      const idx = calls.findIndex((c) => String(c._id) === String(src.bunker.portCall));
      if (idx >= 0) {
        copy.bunker.portCall = created[idx]._id;
        await copy.save();
      }
    }
    await VoyageLog.write(copy._id, req.user, 'CREATED', `Draft ${copy.voyageNo} created as a copy of ${source.voyageNo}`);
    res.status(201).json(await populatedVoyage(copy._id, req.user));
  } catch (err) {
    if (copy) {
      await PortCall.deleteMany({ voyage: copy._id }).catch(() => {});
      await Voyage.deleteOne({ _id: copy._id }).catch(() => {});
    }
    sendError(res, err, 'Error copying voyage');
  }
});

// ------------------------------------------------------------------ task generation (B9)
router.post('/:id/generate-preview', async (req, res) => {
  try {
    const voyage = await loadEditable(req, req.params.id);
    if (voyage.status !== 'DRAFT') throw badRequest('Tasks are previewed before a draft is activated');
    const tasks = await taskEngine.preview(voyage._id);
    res.json({
      tasks,
      totals: {
        total: tasks.length,
        included: tasks.filter((t) => t.included).length,
        optional: tasks.filter((t) => t.isOptional).length,
        awaitingDate: tasks.filter((t) => !t.dueDate).length,
      },
    });
  } catch (err) { sendError(res, err, 'Error previewing tasks'); }
});

// { excluded: [{ code, portCall, reason }], adhocTasks: [{ name, dueDate | anchor+offsetDays, priority, stage, portCall }] }
router.post('/:id/activate', async (req, res) => {
  try {
    const voyage = await loadEditable(req, req.params.id);
    const result = await taskEngine.activate(voyage._id, {
      excluded: Array.isArray(req.body.excluded) ? req.body.excluded : [],
      adhocTasks: Array.isArray(req.body.adhocTasks) ? req.body.adhocTasks : [],
    }, req.user);
    await VoyageLog.write(voyage._id, req.user, 'ACTIVATED',
      `Voyage activated: ${result.created} tasks created (${result.notApplicable} not applicable${result.adhoc ? `, ${result.adhoc} one-off` : ''}); original plan frozen`, result);
    emitVoyageUpdated(req, voyage._id, 'activated');
    res.json({ ...(await populatedVoyage(voyage._id, req.user)), activation: result });
  } catch (err) { sendError(res, err, 'Error activating voyage'); }
});

// ------------------------------------------------------------------ vessel status override (C6)
// { value: 'WAITING_FOR_BERTH' | ... } or { value: null } to go back to the status derived from actuals
router.put('/:id/vessel-status', async (req, res) => {
  try {
    const voyage = await loadEditable(req, req.params.id);
    const value = req.body.value || null;
    if (value && !VESSEL_STATUS_VALUES.includes(value)) throw badRequest(`Unknown vessel status ${value}`);
    voyage.vesselStatusOverride = value ? { value, setBy: req.user._id, setAt: new Date() } : { value: null, setBy: null, setAt: null };
    voyage.updatedBy = req.user._id;
    await voyage.save();
    const label = (v) => (require('../../services/ops/constants').VESSEL_STATUSES.find((x) => x.value === v) || {}).label || v;
    await VoyageLog.write(voyage._id, req.user, 'VESSEL_STATUS', value ? `Vessel status set by hand to ${label(value)}` : 'Vessel status back to automatic (from actual times)');
    emitVoyageUpdated(req, voyage._id, 'vessel-status');
    res.json(await populatedVoyage(voyage._id, req.user));
  } catch (err) { sendError(res, err, 'Error setting vessel status'); }
});

// ------------------------------------------------------------------ tasks (editing one task: /api/ops/tasks)
router.get('/:id/tasks', async (req, res) => {
  try {
    const voyage = await loadVisible(req, req.params.id);
    const filter = { voyage: voyage._id };
    for (const k of ['stage', 'portCall', 'status', 'priority']) if (req.query[k]) filter[k] = req.query[k];
    if (req.query.assignee) filter.assignedTo = req.query.assignee;
    const tasks = await VoyageTask.find(filter)
      .select('-history -reminderSent')
      .populate('stage', 'name code order scope')
      .populate({ path: 'portCall', select: 'seq type port timeZone status', populate: { path: 'port', select: 'name' } })
      .populate('assignedTo', 'employeeName')
      .sort({ sortKey: 1 })
      .lean();
    const today = engine.todayIn();
    let out = tasks.map((t) => ({ ...t, ...engine.derive(t, today) }));
    if (req.query.bucket) out = out.filter((t) => t.bucket === req.query.bucket);
    const byBucket = {};
    for (const t of out) byBucket[t.bucket] = (byBucket[t.bucket] || 0) + 1;
    res.json({ today, total: out.length, byBucket, tasks: out });
  } catch (err) { sendError(res, err, 'Error fetching tasks'); }
});

// Ad-hoc task on an active voyage (D7): { name, dueDate | anchor + offsetDays, priority, stage, portCall, assignedTo, remarks }
router.post('/:id/tasks', async (req, res) => {
  try {
    const voyage = await loadEditable(req, req.params.id);
    if (Array.isArray(req.body.assignedTo) && req.body.assignedTo.some((id) => !mongoose.isValidObjectId(id))) throw badRequest('assignedTo contains an invalid id');
    const task = await taskEngine.addAdhocTask(voyage._id, req.body, req.user);
    emitVoyageUpdated(req, voyage._id, 'tasks');
    const out = await VoyageTask.findById(task._id)
      .populate('stage', 'name code order scope')
      .populate({ path: 'portCall', select: 'seq type port timeZone status', populate: { path: 'port', select: 'name' } })
      .populate('assignedTo', 'employeeName').lean();
    res.status(201).json({ ...out, ...engine.derive(out) });
  } catch (err) { sendError(res, err, 'Error adding task'); }
});

router.get('/:id/revisions', async (req, res) => {
  try {
    const voyage = await loadVisible(req, req.params.id);
    const revisions = await DateRevision.find({ voyage: voyage._id })
      .populate('by', 'username')
      .populate({ path: 'portCall', select: 'seq type port timeZone', populate: { path: 'port', select: 'name' } })
      .sort({ at: -1 })
      .lean();
    res.json(revisions);
  } catch (err) { sendError(res, err, 'Error fetching date revisions'); }
});

// Activity timeline (feature D10): voyage log, key-date revisions and changes people made to tasks.
// System-written task entries (generation, recalculation) are left out — the date revision that caused them says how many moved.
router.get('/:id/activity', async (req, res) => {
  try {
    const voyage = await loadVisible(req, req.params.id);
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 300);
    const [logs, revisions, tasks] = await Promise.all([
      VoyageLog.find({ voyage: voyage._id }).populate('by', 'username').sort({ at: -1 }).limit(limit).lean(),
      DateRevision.find({ voyage: voyage._id }).populate('by', 'username')
        .populate({ path: 'portCall', select: 'seq type timeZone port', populate: { path: 'port', select: 'name' } }).sort({ at: -1 }).limit(limit).lean(),
      VoyageTask.find({ voyage: voyage._id, history: { $elemMatch: { auto: { $ne: true }, field: { $ne: 'created' } } } })
        .select('name code history').populate('history.by', 'username').lean(),
    ]);
    const zoneOf = (r) => {
      if (r.portCall) return r.portCall.timeZone;
      if (r.field.startsWith('delivery.')) return voyage.delivery?.timeZone || OFFICE_TZ;
      if (r.field.startsWith('redelivery.')) return voyage.redelivery?.timeZone || OFFICE_TZ;
      return OFFICE_TZ;
    };
    const items = [
      ...logs.map((l) => ({ kind: 'voyage', at: l.at, by: l.by?.username || 'system', type: l.type, text: l.text })),
      ...revisions.map((r) => ({
        kind: 'date', at: r.at, by: r.by?.username || 'system', field: r.field, port: r.portCall?.port?.name || null,
        from: r.from, to: r.to, zone: zoneOf(r), reason: r.reason, tasksMoved: r.tasksMoved,
      })),
      ...tasks.flatMap((t) => t.history.filter((h) => !h.auto && h.field !== 'created').map((h) => ({
        kind: 'task', at: h.at, by: h.by?.username || 'system', task: t.name, code: t.code, field: h.field, from: h.from, to: h.to, note: h.note,
      }))),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
    res.json({ items });
  } catch (err) { sendError(res, err, 'Error fetching activity'); }
});

router.use('/:id/port-calls', require('./portCalls'));

module.exports = router;
module.exports.loadVisible = loadVisible;
module.exports.loadEditable = loadEditable;
module.exports.populatedVoyage = populatedVoyage;
module.exports.emitDatesChanged = emitDatesChanged;
module.exports.emitVoyageUpdated = emitVoyageUpdated;
