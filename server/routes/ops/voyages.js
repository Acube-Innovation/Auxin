// Voyages (features B1–B10). Port calls: routes/ops/portCalls.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const Vessel = require('../../models/ops/Vessel');
const Counter = require('../../models/ops/Counter');
const access = require('../../services/ops/accessScope');
const { normaliseVoyage, normalisePortCall, badRequest } = require('../../services/ops/voyageInput');
const { OFFICE_TZ } = require('../../services/ops/config');
const { sendError, escapeRegex, httpError } = require('./helpers');
const { VOYAGE_STATUSES } = Voyage;

const CLIENT = 'companyName clientType email phone';
const EMPLOYEE = 'employeeName emailId profilePhoto employeeStatus';

// Status changes allowed through PUT. DRAFT → ACTIVE only through /activate (step 5).
const STATUS_MOVES = {
  DRAFT: ['CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ACTIVE'],
  CANCELLED: ['DRAFT'],
};

// voyageFilter() returns strings (fine for find); aggregation needs real ObjectIds
function aggregateScope(scope) {
  if (scope._id === null) return { _id: null };
  if (scope.operators) return { operators: new mongoose.Types.ObjectId(scope.operators) };
  return {};
}

async function nextVoyageNo() {
  const year = DateTime.now().setZone(OFFICE_TZ).year;
  const n = await Counter.next(`voyage-${year}`);
  return `VOY-${year}-${String(n).padStart(4, '0')}`;
}

// Load a voyage the user may see (404 otherwise, so ids of hidden voyages are not revealed)
async function loadVisible(req, id) {
  const voyage = await Voyage.findById(id);
  if (!voyage || !access.canView(req.user, voyage)) throw httpError(404, 'Voyage not found');
  return voyage;
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
  return { ...voyage, portCalls, permissions: access.permissionsFor(user, voyage) };
}

// Who is creating: operators are always added to the operators list
function withCreatorAsOperator(user, operators) {
  const emp = access.employeeIdOf(user);
  if (user.role === 'operations_executive' || user.role === 'executive_post_fixture') {
    if (!emp) throw badRequest('Your login is not linked to an employee. Ask an admin to link it in User Management (“Select Employee”).');
    return [...new Set([...(operators || []), emp])];
  }
  return operators || [];
}

// ------------------------------------------------------------------ list
router.get('/', async (req, res) => {
  try {
    const scope = access.voyageFilter(req.user);
    const filter = { ...scope };
    const { status, vesselStatus, vessel, operator, search } = req.query;
    if (status && status !== 'ALL') {
      if (!VOYAGE_STATUSES.includes(status)) throw badRequest(`status must be one of ${VOYAGE_STATUSES.join(', ')} or ALL`);
      filter.status = status;
    }
    if (vesselStatus) filter.vesselStatus = vesselStatus;
    if (vessel) filter.vessel = vessel;
    if (operator) filter.operators = scope.operators ? { $all: [scope.operators, operator] } : operator;
    if (search) {
      const rx = { $regex: escapeRegex(search.trim()), $options: 'i' };
      const vesselIds = await Vessel.find({ name: rx }).distinct('_id');
      filter.$or = [{ voyageNo: rx }, { vessel: { $in: vesselIds } }];
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [items, total, byStatus] = await Promise.all([
      Voyage.find(filter)
        .select('voyageNo status voyageType vesselStatus vessel charterers operators delivery redelivery cargo updatedAt createdAt')
        .populate('vessel', 'name')
        .populate('charterers', 'companyName')
        .populate('operators', 'employeeName')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Voyage.countDocuments(filter),
      Voyage.aggregate([{ $match: aggregateScope(scope) }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);

    const calls = await PortCall.find({ voyage: { $in: items.map((v) => v._id) } })
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

    const counts = Object.fromEntries(VOYAGE_STATUSES.map((s) => [s, 0]));
    byStatus.forEach((r) => { counts[r._id] = r.n; });
    counts.ALL = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({
      items: items.map((v) => ({ ...v, rotation: rotation.get(String(v._id)) || [], permissions: access.permissionsFor(req.user, v) })),
      total,
      page,
      limit,
      counts,
      canCreate: access.canCreate(req.user),
    });
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
    for (const [i, pc] of portInputs.entries()) portCalls.push(await normalisePortCall(pc, null, i));

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
    res.status(201).json(await populatedVoyage(voyage._id, req.user));
  } catch (err) {
    // No transactions on a standalone MongoDB: undo a half-created voyage by hand
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

// ------------------------------------------------------------------ update
router.put('/:id', async (req, res) => {
  try {
    const voyage = await loadVisible(req, req.params.id);
    if (!access.canEdit(req.user, voyage)) throw httpError(403, 'You cannot edit this voyage');

    const wantsStatus = req.body.status && req.body.status !== voyage.status;
    if (wantsStatus) {
      const to = req.body.status;
      if (to === 'ACTIVE' && voyage.status === 'DRAFT') throw badRequest('A draft becomes Active through “Activate” (task generation), not by editing its status');
      if (!(STATUS_MOVES[voyage.status] || []).includes(to)) throw badRequest(`A ${voyage.status.toLowerCase()} voyage cannot be changed to ${String(to).toLowerCase()}`);
    }
    const editableFields = Object.keys(req.body).filter((k) => k !== 'status');
    if (editableFields.length && !['DRAFT', 'ACTIVE'].includes(voyage.status)) {
      throw badRequest(`A ${voyage.status.toLowerCase()} voyage cannot be edited. Re-open it first.`);
    }

    const data = await normaliseVoyage(req.body, voyage.toObject());
    if (data.operators && !data.operators.length) throw badRequest('A voyage needs at least one operator');
    if (data.bunker && data.bunker.portCall) {
      const pc = await PortCall.findOne({ _id: data.bunker.portCall, voyage: voyage._id });
      if (!pc || pc.type !== 'BUNKERING') throw badRequest('The bunkering port call must be a BUNKERING call of this voyage');
    }
    Object.assign(voyage, data, { updatedBy: req.user._id });
    if (wantsStatus) voyage.status = req.body.status;
    await voyage.save();
    // Due-date recalculation is triggered here from step 4
    res.json(await populatedVoyage(voyage._id, req.user));
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
    res.status(201).json(await populatedVoyage(copy._id, req.user));
  } catch (err) {
    if (copy) {
      await PortCall.deleteMany({ voyage: copy._id }).catch(() => {});
      await Voyage.deleteOne({ _id: copy._id }).catch(() => {});
    }
    sendError(res, err, 'Error copying voyage');
  }
});

router.use('/:id/port-calls', require('./portCalls'));

module.exports = router;
module.exports.loadVisible = loadVisible;
module.exports.populatedVoyage = populatedVoyage;
