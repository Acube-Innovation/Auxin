// Port rotation of a voyage (features B6, C1): /api/ops/voyages/:id/port-calls
const express = require('express');
const router = express.Router({ mergeParams: true });
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const access = require('../../services/ops/accessScope');
const { normalisePortCall, badRequest } = require('../../services/ops/voyageInput');
const { sendError, httpError } = require('./helpers');

const POPULATE = [
  { path: 'port', select: 'name country unlocode timeZone' },
  { path: 'agent', select: 'companyName clientType email phone' },
];

// Voyage must be visible; writes need edit rights and a voyage that is still open
async function loadVoyage(req, forWrite) {
  const voyage = await Voyage.findById(req.params.id);
  if (!voyage || !access.canView(req.user, voyage)) throw httpError(404, 'Voyage not found');
  if (forWrite) {
    if (!access.canEdit(req.user, voyage)) throw httpError(403, 'You cannot edit this voyage');
    if (!['DRAFT', 'ACTIVE'].includes(voyage.status)) throw badRequest(`A ${voyage.status.toLowerCase()} voyage cannot be edited`);
  }
  return voyage;
}

const listFor = (voyageId) => PortCall.find({ voyage: voyageId }).populate(POPULATE).sort({ seq: 1 }).lean();

// Give port calls the sequence 1..n in the order of `ids`. Two passes because (voyage, seq) is unique.
async function resequence(voyageId, ids) {
  if (!ids.length) return;
  await PortCall.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, voyage: voyageId }, update: { $set: { seq: -(i + 1) } } } })));
  await PortCall.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, voyage: voyageId }, update: { $set: { seq: i + 1 } } } })));
}

router.get('/', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, false);
    res.json(await listFor(voyage._id));
  } catch (err) { sendError(res, err, 'Error fetching port calls'); }
});

// Add a port call. Optional `position` (1-based) inserts it; default is the end of the rotation.
router.post('/', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const data = await normalisePortCall(req.body, null);
    const existing = await PortCall.find({ voyage: voyage._id }).sort({ seq: 1 }).select('_id').lean();
    const created = await PortCall.create({ ...data, voyage: voyage._id, seq: existing.length + 1000, updatedBy: req.user._id });
    const ids = existing.map((p) => String(p._id));
    const pos = Number.isInteger(req.body.position) ? Math.min(Math.max(req.body.position, 1), ids.length + 1) : ids.length + 1;
    ids.splice(pos - 1, 0, String(created._id));
    await resequence(voyage._id, ids);
    voyage.updatedBy = req.user._id;
    await voyage.save();
    // Step 5: tasks for the new port call are generated here when the voyage is active
    res.status(201).json({ portCall: await PortCall.findById(created._id).populate(POPULATE).lean(), portCalls: await listFor(voyage._id) });
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
    await resequence(voyage._id, order);
    voyage.updatedBy = req.user._id;
    await voyage.save();
    res.json(await listFor(voyage._id));
  } catch (err) { sendError(res, err, 'Error re-ordering port calls'); }
});

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
    const data = await normalisePortCall(req.body, pc.toObject());
    Object.assign(pc, data, { updatedBy: req.user._id });
    await pc.save();
    voyage.updatedBy = req.user._id;
    await voyage.save();
    // Step 4: due-date recalculation and vessel status run here; the response will list moved tasks
    res.json({ portCall: await PortCall.findById(pc._id).populate(POPULATE).lean(), portCalls: await listFor(voyage._id) });
  } catch (err) { sendError(res, err, 'Error updating port call'); }
});

// Draft voyage: the port call is removed. Active voyage: it is cancelled and kept for the record.
router.delete('/:pcId', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const pc = await PortCall.findOne({ _id: req.params.pcId, voyage: voyage._id });
    if (!pc) throw httpError(404, 'Port call not found');
    const isBunkerCall = String(voyage.bunker?.portCall) === String(pc._id);

    if (voyage.status === 'DRAFT') {
      await pc.deleteOne();
      const rest = (await PortCall.find({ voyage: voyage._id }).sort({ seq: 1 }).select('_id').lean()).map((p) => String(p._id));
      await resequence(voyage._id, rest);
      if (isBunkerCall) voyage.bunker.portCall = null;
    } else {
      pc.status = 'CANCELLED';
      pc.updatedBy = req.user._id;
      await pc.save();
      // Step 5: open tasks of this port call become Not Applicable ("Port call cancelled")
    }
    voyage.updatedBy = req.user._id;
    await voyage.save();
    res.json({ message: voyage.status === 'DRAFT' ? 'Port call removed' : 'Port call cancelled', portCalls: await listFor(voyage._id) });
  } catch (err) { sendError(res, err, 'Error removing port call'); }
});

module.exports = router;
