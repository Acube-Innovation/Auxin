// Daily checklist of a voyage (features E1, E2, D9): /api/ops/voyages/:id/daily-checks
// GET ?date=YYYY-MM-DD (office date, default today) · PATCH /items/:itemId { done, remark } (today only)
const express = require('express');
const router = express.Router({ mergeParams: true });
const mongoose = require('mongoose');
const Voyage = require('../../models/ops/Voyage');
const DailyCheckLog = require('../../models/ops/DailyCheckLog');
const VoyageTask = require('../../models/ops/VoyageTask');
const access = require('../../services/ops/accessScope');
const engine = require('../../services/ops/dueDateEngine');
const dailyChecks = require('../../services/ops/dailyChecks');
const { generateRecurring } = require('../../services/ops/recurring');
const { badRequest } = require('../../services/ops/voyageInput');
const { sendError, httpError } = require('./helpers');

async function loadVoyage(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Voyage not found');
  const voyage = await Voyage.findById(req.params.id);
  if (!voyage || !(await access.canView(req.user, voyage))) throw httpError(404, 'Voyage not found');
  return voyage;
}

async function payload(req, voyage, date) {
  const today = engine.todayIn();
  let log = null;
  let preview = null;
  if (date === today && voyage.status === 'ACTIVE') {
    log = await dailyChecks.ensureToday(voyage);
  } else {
    log = await DailyCheckLog.findOne({ voyage: voyage._id, date });
    if (!log && date > today && voyage.status === 'ACTIVE') preview = await dailyChecks.previewItems(voyage);
  }
  if (log) log = await DailyCheckLog.findById(log._id).populate('items.doneBy', 'username').populate('items.remarkBy', 'username').lean();
  const history = (await DailyCheckLog.find({ voyage: voyage._id }).select('date vesselStatus statuses items.done').sort({ date: -1 }).limit(60).lean())
    .map((l) => ({ date: l.date, vesselStatus: l.vesselStatus, statuses: l.statuses, done: l.items.filter((i) => i.done).length, total: l.items.length }));
  const recurring = (await VoyageTask.find({ voyage: voyage._id, 'recurrence.everyDays': { $gt: 0 } })
    .select('-history -reminderSent').populate('assignedTo', 'employeeName').sort({ recurrenceIndex: 1 }).lean())
    .map((t) => ({ ...t, ...engine.derive(t, today) }));
  return {
    date,
    today,
    vesselStatus: dailyChecks.effectiveStatus(voyage),
    voyageStatus: voyage.status,
    editable: date === today && voyage.status === 'ACTIVE' && (await access.canEdit(req.user, voyage)),
    log,
    preview,
    history,
    recurring,
  };
}

router.get('/', async (req, res) => {
  try {
    const voyage = await loadVoyage(req);
    const date = req.query.date || engine.todayIn();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('date must be YYYY-MM-DD');
    if (voyage.status === 'ACTIVE') await generateRecurring(voyage._id).catch((e) => console.error('recurring:', e.message));
    res.json(await payload(req, voyage, date));
  } catch (err) { sendError(res, err, 'Error fetching daily checks'); }
});

router.patch('/items/:itemId', async (req, res) => {
  try {
    const voyage = await loadVoyage(req);
    if (!(await access.canEdit(req.user, voyage))) throw httpError(403, 'You cannot tick checks of this voyage');
    if (voyage.status !== 'ACTIVE') throw badRequest(`Checks of a ${voyage.status.toLowerCase()} voyage cannot be changed`);
    const log = await dailyChecks.ensureToday(voyage);
    const item = log.items.id(req.params.itemId);
    if (!item) throw httpError(404, 'Only today’s checks can be ticked; reload the page');
    const now = new Date();
    if (req.body.done !== undefined && Boolean(req.body.done) !== item.done) {
      item.done = Boolean(req.body.done);
      item.doneBy = item.done ? req.user._id : null;
      item.doneAt = item.done ? now : null;
      item.auto = false;
      item.autoNote = undefined;
    }
    if (req.body.remark !== undefined && String(req.body.remark || '') !== item.remark) {
      item.remark = String(req.body.remark || '').slice(0, 1000);
      item.remarkBy = req.user._id;
      item.remarkAt = now;
    }
    await log.save();
    const io = req.app.get('io');
    if (io) io.to(`voyage-${voyage._id}`).emit('ops-voyage-updated', { voyageId: String(voyage._id), what: 'checks', by: String(req.user._id), byName: req.user.username });
    res.json(await payload(req, voyage, log.date));
  } catch (err) { sendError(res, err, 'Error updating daily check'); }
});

module.exports = router;
