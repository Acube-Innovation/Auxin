// Port rotation of a voyage (features B6, B7, C1–C6): /api/ops/voyages/:id/port-calls
// On an active voyage every change recalculates the open tasks' due dates and the vessel status, in one transaction.
const express = require('express');
const router = express.Router({ mergeParams: true });
const mongoose = require('mongoose');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const DateRevision = require('../../models/ops/DateRevision');
const VoyageLog = require('../../models/ops/VoyageLog');
const Port = require('../../models/ops/Port');
const access = require('../../services/ops/accessScope');
const taskEngine = require('../../services/ops/taskEngine');
const { applySuggestions, manualFlagsFromInput } = require('../../services/ops/suggestions');
const { normalisePortCall, assertPortCallOrder, badRequest } = require('../../services/ops/voyageInput');
const { sendError, httpError } = require('./helpers');

const POPULATE = [
  { path: 'port', select: 'name country unlocode timeZone' },
  { path: 'agent', select: 'companyName clientType email phone' },
];
const PLANNED = ['eta', 'etb', 'etc', 'ets'];
const ACTUAL = ['ata', 'norTendered', 'pob', 'atb', 'commenced', 'completed', 'atd'];
const timeOf = (d) => (d ? new Date(d).getTime() : null);
const NONE = { movedTasks: [], dueSoon: [] };

// Voyage must be visible; writes need edit rights and a voyage that is still open
async function loadVoyage(req, forWrite) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Voyage not found');
  const voyage = await Voyage.findById(req.params.id);
  if (!voyage || !(await access.canView(req.user, voyage))) throw httpError(404, 'Voyage not found');
  if (forWrite) {
    if (!(await access.canEdit(req.user, voyage))) throw httpError(403, 'You cannot edit this voyage');
    if (!['DRAFT', 'ACTIVE'].includes(voyage.status)) throw badRequest(`A ${voyage.status.toLowerCase()} voyage cannot be edited`);
  }
  return voyage;
}

const listFor = (voyageId) => PortCall.find({ voyage: voyageId }).populate(POPULATE).sort({ seq: 1 }).lean();

// Give port calls the sequence 1..n in the order of `ids`. Two passes because (voyage, seq) is unique.
async function resequence(voyageId, ids, session) {
  if (!ids.length) return;
  await PortCall.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, voyage: voyageId }, update: { $set: { seq: -(i + 1) } } } })), { session });
  await PortCall.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, voyage: voyageId }, update: { $set: { seq: i + 1 } } } })), { session });
}

// After a change on an active voyage: recalculate due dates, vessel status, and log key-date revisions
async function afterChange(voyage, session, req, revisions = []) {
  if (voyage.status !== 'ACTIVE') {
    await taskEngine.refreshVesselStatus(voyage._id, { session });
    return NONE;
  }
  const recalc = await taskEngine.recalculate(voyage._id, { session, user: req.user, reason: req.body && req.body.reason });
  await taskEngine.refreshVesselStatus(voyage._id, { session });
  if (revisions.length) {
    await DateRevision.insertMany(revisions.map((r) => ({ ...r, voyage: voyage._id, by: req.user._id, reason: (req.body && req.body.reason) || '', tasksMoved: recalc.movedTasks.length })), { session });
  }
  return recalc;
}

function emitDatesChanged(req, voyageId, result) {
  const io = req.app.get('io');
  if (io && result.movedTasks.length) {
    io.to(`voyage-${voyageId}`).emit('ops-dates-changed', { voyageId: String(voyageId), moved: result.movedTasks.length, dueSoon: result.dueSoon.length });
  }
}

function emitVoyageUpdated(req, voyageId, what) {
  const io = req.app.get('io');
  if (io) io.to(`voyage-${voyageId}`).emit('ops-voyage-updated', { voyageId: String(voyageId), what, by: String(req.user._id), byName: req.user.username });
}
const TYPE_WORD = { LOADING: 'load', DISCHARGING: 'discharge', BUNKERING: 'bunkering' };
const portName = async (id) => ((await Port.findById(id).select('name').lean()) || {}).name || 'port';

router.get('/', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, false);
    res.json(await listFor(voyage._id));
  } catch (err) { sendError(res, err, 'Error fetching port calls'); }
});

// Add a port call. Optional `position` (1-based) inserts it; default is the end of the rotation.
// On an active voyage its tasks are generated straight away.
router.post('/', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const data = await normalisePortCall(req.body, null);
    data.manual = manualFlagsFromInput(req.body, null);
    applySuggestions(data);
    assertPortCallOrder(data);

    const out = await taskEngine.withTransaction(async (session) => {
      const existing = await PortCall.find({ voyage: voyage._id }).sort({ seq: 1 }).select('_id').session(session).lean();
      const [created] = await PortCall.create([{ ...data, voyage: voyage._id, seq: existing.length + 1000, updatedBy: req.user._id }], { session });
      const ids = existing.map((p) => String(p._id));
      const pos = Number.isInteger(req.body.position) ? Math.min(Math.max(req.body.position, 1), ids.length + 1) : ids.length + 1;
      ids.splice(pos - 1, 0, String(created._id));
      await resequence(voyage._id, ids, session);
      await Voyage.updateOne({ _id: voyage._id }, { $set: { updatedBy: req.user._id } }, { session });
      const tasksCreated = await taskEngine.addPortCallTasks(voyage._id, created._id, { session, user: req.user });
      const recalc = await afterChange(voyage, session, req);
      return { id: created._id, tasksCreated, ...recalc };
    });
    emitDatesChanged(req, voyage._id, out);
    emitVoyageUpdated(req, voyage._id, 'port-call');
    if (voyage.status === 'ACTIVE') {
      await VoyageLog.write(voyage._id, req.user, 'PORT_CALL_ADDED', `${await portName(data.port)} (${TYPE_WORD[data.type]}) added to the rotation; ${out.tasksCreated} tasks created`);
    }
    res.status(201).json({
      portCall: await PortCall.findById(out.id).populate(POPULATE).lean(),
      portCalls: await listFor(voyage._id),
      tasksCreated: out.tasksCreated,
      movedTasks: out.movedTasks,
      dueSoon: out.dueSoon,
    });
  } catch (err) { sendError(res, err, 'Error adding port call'); }
});

// { order: [portCallId, ...] } — every port call of the voyage, in the new order. Declared before /:pcId.
router.put('/reorder', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const order = Array.isArray(req.body.order) ? req.body.order.map(String) : [];
    const all = (await PortCall.find({ voyage: voyage._id }).select('_id').lean()).map((p) => String(p._id));
    if (order.length !== all.length || new Set(order).size !== all.length || !order.every((id) => all.includes(id))) {
      throw badRequest('order must list every port call of this voyage exactly once');
    }
    const out = await taskEngine.withTransaction(async (session) => {
      await resequence(voyage._id, order, session);
      await Voyage.updateOne({ _id: voyage._id }, { $set: { updatedBy: req.user._id } }, { session });
      return afterChange(voyage, session, req);
    });
    emitDatesChanged(req, voyage._id, out);
    emitVoyageUpdated(req, voyage._id, 'port-call');
    if (voyage.status === 'ACTIVE') {
      const names = (await listFor(voyage._id)).filter((p) => p.status !== 'CANCELLED').map((p) => p.port?.name);
      await VoyageLog.write(voyage._id, req.user, 'ROTATION_REORDERED', `Rotation re-ordered: ${names.join(' → ')}`);
    }
    res.json(await listFor(voyage._id));
  } catch (err) { sendError(res, err, 'Error re-ordering port calls'); }
});

// Update planned / actual times and details. Response lists the tasks whose due dates moved (feature F3).
router.put('/:pcId', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const pc = await PortCall.findOne({ _id: req.params.pcId, voyage: voyage._id });
    if (!pc) throw httpError(404, 'Port call not found');
    if (pc.status === 'CANCELLED') throw badRequest('This port call is cancelled');
    if (req.body.type && req.body.type !== pc.type && voyage.status !== 'DRAFT') {
      throw badRequest('The type of a port call cannot change once the voyage is active (its tasks depend on it). Cancel it and add a new port call.');
    }
    if (req.body.type && req.body.type !== pc.type && String(voyage.bunker?.portCall) === String(pc._id) && req.body.type !== 'BUNKERING') {
      throw badRequest('This port call is the voyage’s bunkering call. Change the bunker details first.');
    }
    if (req.body.port && String(req.body.port) !== String(pc.port) && voyage.status !== 'DRAFT') {
      throw badRequest('The port of a call cannot change once the voyage is active. Cancel it and add a new port call.');
    }

    const before = pc.toObject();
    const data = await normalisePortCall(req.body, before);
    Object.assign(pc, data, { manual: manualFlagsFromInput(req.body, before.manual), updatedBy: req.user._id });
    applySuggestions(pc);
    assertPortCallOrder(pc);

    const revisions = [];
    for (const k of PLANNED) {
      if (timeOf(before.planned?.[k]) !== timeOf(pc.planned[k])) revisions.push({ portCall: pc._id, field: `planned.${k}`, from: before.planned?.[k] || null, to: pc.planned[k] || null });
    }
    const actualChanged = [];
    for (const k of ACTUAL) {
      if (timeOf(before.actual?.[k]) !== timeOf(pc.actual[k])) {
        actualChanged.push(k);
        revisions.push({ portCall: pc._id, field: `actual.${k}`, from: before.actual?.[k] || null, to: pc.actual[k] || null });
      }
    }

    const out = await taskEngine.withTransaction(async (session) => {
      await pc.save({ session });
      const update = { updatedBy: req.user._id };
      // Entering an actual time ends a manual vessel-status override (C6)
      if (actualChanged.length) update.vesselStatusOverride = { value: null, setBy: null, setAt: null };
      await Voyage.updateOne({ _id: voyage._id }, { $set: update }, { session });
      return afterChange(voyage, session, req, revisions);
    });
    emitDatesChanged(req, voyage._id, out);
    emitVoyageUpdated(req, voyage._id, 'port-call');
    res.json({
      portCall: await PortCall.findById(pc._id).populate(POPULATE).lean(),
      portCalls: await listFor(voyage._id),
      movedTasks: out.movedTasks,
      dueSoon: out.dueSoon,
    });
  } catch (err) { sendError(res, err, 'Error updating port call'); }
});

// Draft voyage: the port call is removed. Active voyage: it is cancelled, kept for the record,
// and its open tasks become Not applicable ("Port call cancelled").
router.delete('/:pcId', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const pc = await PortCall.findOne({ _id: req.params.pcId, voyage: voyage._id });
    if (!pc) throw httpError(404, 'Port call not found');
    if (pc.status === 'CANCELLED') throw badRequest('This port call is already cancelled');
    const isBunkerCall = String(voyage.bunker?.portCall) === String(pc._id);

    const out = await taskEngine.withTransaction(async (session) => {
      let tasksCancelled = 0;
      if (voyage.status === 'DRAFT') {
        await PortCall.deleteOne({ _id: pc._id }, { session });
        const rest = (await PortCall.find({ voyage: voyage._id }).sort({ seq: 1 }).select('_id').session(session).lean()).map((p) => String(p._id));
        await resequence(voyage._id, rest, session);
        const set = { updatedBy: req.user._id };
        if (isBunkerCall) set['bunker.portCall'] = null;
        await Voyage.updateOne({ _id: voyage._id }, { $set: set }, { session });
      } else {
        await PortCall.updateOne({ _id: pc._id }, { $set: { status: 'CANCELLED', updatedBy: req.user._id } }, { session });
        tasksCancelled = await taskEngine.cancelPortCallTasks(pc._id, { session, user: req.user });
        await Voyage.updateOne({ _id: voyage._id }, { $set: { updatedBy: req.user._id } }, { session });
      }
      return { tasksCancelled, ...(await afterChange(voyage, session, req)) };
    });
    emitDatesChanged(req, voyage._id, out);
    emitVoyageUpdated(req, voyage._id, 'port-call');
    if (voyage.status === 'ACTIVE') {
      await VoyageLog.write(voyage._id, req.user, 'PORT_CALL_CANCELLED', `${await portName(pc.port)} (${TYPE_WORD[pc.type]}) cancelled; ${out.tasksCancelled} open task(s) marked Not applicable${req.body && req.body.reason ? ` — ${req.body.reason}` : ''}`);
    }
    res.json({
      message: voyage.status === 'DRAFT' ? 'Port call removed' : `Port call cancelled; ${out.tasksCancelled} open task(s) marked Not applicable`,
      portCalls: await listFor(voyage._id),
      tasksCancelled: out.tasksCancelled,
      movedTasks: out.movedTasks,
      dueSoon: out.dueSoon,
    });
  } catch (err) { sendError(res, err, 'Error removing port call'); }
});

module.exports = router;
