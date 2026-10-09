// Voyage tasks (features D1–D10, C5, G1): /api/ops/tasks
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const Voyage = require('../../models/ops/Voyage');
const VoyageTask = require('../../models/ops/VoyageTask');
const DateRevision = require('../../models/ops/DateRevision');
const access = require('../../services/ops/accessScope');
const taskEngine = require('../../services/ops/taskEngine');
const engine = require('../../services/ops/dueDateEngine');
const { applyTaskPatch, writeLinkedValue, resolveLinkedTarget, badRequest } = require('../../services/ops/taskUpdate');
const timer = require('../../services/ops/taskTimer');
const { sendError, httpError } = require('./helpers');

// Task attachments are kept outside the public /uploads folder and served only to people who may see the voyage
const STORAGE = path.join(__dirname, '..', '..', 'storage', 'voyages');
const MAX_MB = 20;

const POPULATE = [
  { path: 'stage', select: 'name code order scope' },
  { path: 'portCall', select: 'seq type port timeZone status', populate: { path: 'port', select: 'name' } },
  { path: 'assignedTo', select: 'employeeName emailId' },
];

function emitUpdated(req, voyageIds, what = 'tasks') {
  const io = req.app.get('io');
  if (!io) return;
  for (const id of new Set(voyageIds.map(String))) {
    io.to(`voyage-${id}`).emit('ops-voyage-updated', { voyageId: id, what, by: String(req.user._id), byName: req.user.username });
  }
}

async function loadTask(req, taskId, { forWrite = false, session = null } = {}) {
  if (!mongoose.isValidObjectId(taskId)) throw httpError(404, 'Task not found');
  const task = await VoyageTask.findById(taskId).session(session);
  if (!task) throw httpError(404, 'Task not found');
  const voyage = await Voyage.findById(task.voyage).session(session);
  if (!voyage || !(await access.canView(req.user, voyage))) throw httpError(404, 'Task not found');
  if (forWrite) {
    if (!(await access.canEdit(req.user, voyage))) throw httpError(403, 'You cannot change tasks of this voyage');
    if (voyage.status !== 'ACTIVE') throw badRequest(`Tasks of a ${voyage.status.toLowerCase()} voyage cannot be changed`);
  }
  return { task, voyage };
}

async function taskOut(id) {
  const t = await VoyageTask.findById(id).populate(POPULATE).populate('history.by', 'username').populate('attachments.uploadedBy', 'username')
    .populate('timeLog.by', 'username').lean();
  await timer.fillPlannedHours([t]);
  return { ...t, ...engine.derive(t), actualSeconds: timer.actualSeconds(t) };
}

// ------------------------------------------------------------------ my tasks across voyages (G1 cross-voyage)
router.get('/mine', async (req, res) => {
  try {
    const emp = access.employeeIdOf(req.user);
    if (!emp) return res.json({ today: engine.todayIn(), total: 0, byBucket: {}, tasks: [], notLinked: true });
    const activeIds = await Voyage.find({ status: 'ACTIVE' }).distinct('_id');
    const filter = { assignedTo: emp, voyage: { $in: activeIds } };
    if (req.query.voyage) filter.voyage = req.query.voyage;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.includeClosed !== 'true' && !req.query.status) filter.status = { $in: taskEngine.OPEN };
    const tasks = await VoyageTask.find(filter)
      .select('-history -reminderSent')
      .populate(POPULATE)
      .populate({ path: 'voyage', select: 'voyageNo vessel vesselStatus vesselStatusOverride', populate: { path: 'vessel', select: 'name' } })
      .lean();
    const today = engine.todayIn();
    await timer.fillPlannedHours(tasks);
    let out = tasks.map((t) => ({ ...t, ...engine.derive(t, today), actualSeconds: timer.actualSeconds(t) }));
    // Earliest due first, tasks without a date last
    out.sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')) || a.sortKey - b.sortKey);
    const byBucket = {};
    for (const t of out) byBucket[t.bucket] = (byBucket[t.bucket] || 0) + 1;
    if (req.query.bucket) out = out.filter((t) => t.bucket === req.query.bucket);
    res.json({ today, total: out.length, byBucket, tasks: out });
  } catch (err) { sendError(res, err, 'Error fetching your tasks'); }
});

// ------------------------------------------------------------------ bulk changes (D8): { ids, patch }
// patch: status (+ naReason), priority, assignedTo (replace), addAssignees, dueDate. Declared before /:taskId.
router.post('/bulk', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(String))] : [];
    const patch = req.body.patch || {};
    if (!ids.length) throw badRequest('Select at least one task');
    if (ids.length > 500) throw badRequest('At most 500 tasks at a time');
    const allowed = ['status', 'naReason', 'priority', 'assignedTo', 'addAssignees', 'dueDate'];
    if (!Object.keys(patch).some((k) => allowed.includes(k))) throw badRequest('Nothing to change');

    const result = await taskEngine.withTransaction(async (session) => {
      const updated = [];
      const skipped = [];
      const voyages = new Map();
      for (const id of ids) {
        try {
          const { task, voyage } = await loadTask(req, id, { forWrite: true, session });
          const p = { ...patch };
          if (p.dueDate !== undefined && !p.status && ['DONE', 'NA'].includes(task.status)) throw badRequest('Done / N/A tasks keep their due date');
          if (p.addAssignees) {
            p.assignedTo = [...new Set([...(task.assignedTo || []).map(String), ...p.addAssignees.map(String)])];
            delete p.addAssignees;
          }
          const changes = await applyTaskPatch(task, p, { session });
          if (changes.length) {
            changes.forEach((c) => task.history.push({ at: new Date(), by: req.user._id, ...c, note: 'Bulk change' }));
            await task.save({ session });
            updated.push(String(task._id));
            voyages.set(String(voyage._id), true);
          }
        } catch (e) {
          skipped.push({ id, reason: e.message });
        }
      }
      // Unlocking / re-dating never needs a recalculation here; due dates set by hand are locked
      return { updated, skipped, voyages: [...voyages.keys()] };
    });
    emitUpdated(req, result.voyages);
    res.json({ updated: result.updated.length, skipped: result.skipped });
  } catch (err) { sendError(res, err, 'Error changing tasks'); }
});

// ------------------------------------------------------------------ one task
router.get('/:taskId', async (req, res) => {
  try {
    const { task, voyage } = await loadTask(req, req.params.taskId);
    const out = await taskOut(task._id);
    let linked = null;
    if (task.linkedField) {
      try {
        const target = await resolveLinkedTarget(task, voyage);
        const current = target.kind === 'portCall' ? target.portCall[target.group]?.[target.key] : voyage[target.group]?.[target.key];
        linked = { field: task.linkedField, zone: target.zone, current: current || null, where: target.kind === 'portCall' ? target.portCall._id : null };
      } catch (e) {
        linked = { field: task.linkedField, error: e.message };
      }
    }
    res.json({ ...out, linked, canEdit: voyage.status === 'ACTIVE' && (await access.canEdit(req.user, voyage)) });
  } catch (err) { sendError(res, err, 'Error fetching task'); }
});

// PATCH { status, naReason, startDate, completedDate, dueDate, unlockDueDate, priority, assignedTo, remarks,
//         linkedValue (ISO time recorded on the voyage when the task has a linked field, C5) }
router.patch('/:taskId', async (req, res) => {
  try {
    const out = await taskEngine.withTransaction(async (session) => {
      const { task, voyage } = await loadTask(req, req.params.taskId, { forWrite: true, session });
      const changes = await applyTaskPatch(task, req.body, { session });
      let linked = null;
      if (req.body.linkedValue !== undefined && req.body.linkedValue !== null && req.body.linkedValue !== '') {
        if (!task.linkedField) throw badRequest('This task does not record a date on the voyage');
        linked = await writeLinkedValue(task, voyage, req.body.linkedValue, { session });
        if (linked && linked.revision) changes.push({ field: 'linkedValue', from: linked.revision.from, to: linked.revision.to });
      }
      if (!changes.length) return { task, voyage, movedTasks: [], dueSoon: [] };
      changes.forEach((c) => task.history.push({ at: new Date(), by: req.user._id, ...c, note: req.body.note || undefined }));
      await task.save({ session });

      let recalc = { movedTasks: [], dueSoon: [] };
      const needsRecalc = (linked && linked.revision) || req.body.unlockDueDate;
      if (needsRecalc) {
        if (linked && linked.actualChanged) await Voyage.updateOne({ _id: voyage._id }, { $set: { vesselStatusOverride: { value: null, setBy: null, setAt: null } } }, { session });
        recalc = await taskEngine.recalculate(voyage._id, { session, user: req.user, reason: linked && linked.revision ? `Recorded when completing "${task.name}"` : 'Due date unlocked' });
        await taskEngine.refreshVesselStatus(voyage._id, { session });
        if (linked && linked.revision) {
          await DateRevision.create([{ ...linked.revision, voyage: voyage._id, by: req.user._id, reason: `Recorded when completing "${task.name}"`, tasksMoved: recalc.movedTasks.length }], { session });
          const ticked = await taskEngine.linkedEntered(voyage._id, [linked.changed], { session, user: req.user });
          recalc.autoCompleted = ticked.tasks;
          recalc.checksTicked = ticked.checks;
        }
      }
      return { task, voyage, ...recalc };
    });
    emitUpdated(req, [out.voyage._id]);
    const io = req.app.get('io');
    if (out.movedTasks.length) require('../../services/ops/etaAlerts').datesChanged(out.voyage._id, out, req.user);
    if (io && out.movedTasks.length) io.to(`voyage-${out.voyage._id}`).emit('ops-dates-changed', { voyageId: String(out.voyage._id), moved: out.movedTasks.length, dueSoon: out.dueSoon.length });
    res.json({ task: await taskOut(out.task._id), movedTasks: out.movedTasks.filter((m) => String(m.id) !== String(out.task._id)), dueSoon: out.dueSoon, autoCompleted: out.autoCompleted || 0, checksTicked: out.checksTicked || 0 });
  } catch (err) { sendError(res, err, 'Error updating task'); }
});

// ------------------------------------------------------------------ working time: { action: 'start' | 'hold' | 'stop' }
// Starting a task that was not started marks it Initiated.
router.post('/:taskId/timer', async (req, res) => {
  try {
    const out = await taskEngine.withTransaction(async (session) => {
      const { task, voyage } = await loadTask(req, req.params.taskId, { forWrite: true, session });
      const now = new Date();
      const entries = [timer.applyTimerAction(task, req.body.action, req.user, now)];
      if (req.body.action === 'start' && task.status === 'NOT_STARTED') entries.push(...await applyTaskPatch(task, { status: 'INITIATED' }, { session }));
      entries.forEach((c) => task.history.push({ at: now, by: req.user._id, ...c }));
      await task.save({ session });
      return { task, voyage };
    });
    emitUpdated(req, [out.voyage._id]);
    res.json({ task: await taskOut(out.task._id) });
  } catch (err) { sendError(res, err, 'Error updating the timer'); }
});

// ------------------------------------------------------------------ attachments (D1)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(STORAGE, String(req.taskVoyage), 'tasks');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\- ]+/g, '_')}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

router.post('/:taskId/attachments', async (req, res, next) => {
  try {
    const { task } = await loadTask(req, req.params.taskId, { forWrite: true });
    req.taskVoyage = task.voyage;
    next();
  } catch (err) { sendError(res, err, 'Error uploading file'); }
}, (req, res, next) => upload.single('file')(req, res, (err) => {
  if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? `Files can be at most ${MAX_MB} MB` : err.message });
  return next();
}), async (req, res) => {
  try {
    if (!req.file) throw badRequest('Choose a file to upload');
    const task = await VoyageTask.findById(req.params.taskId);
    task.attachments.push({
      fileName: req.file.originalname,
      filePath: path.relative(STORAGE, req.file.path),
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      at: new Date(),
    });
    task.history.push({ at: new Date(), by: req.user._id, field: 'attachment', to: req.file.originalname, note: 'File attached' });
    await task.save();
    emitUpdated(req, [task.voyage]);
    res.status(201).json(await taskOut(task._id));
  } catch (err) { sendError(res, err, 'Error uploading file'); }
});

router.get('/:taskId/attachments/:attId', async (req, res) => {
  try {
    const { task } = await loadTask(req, req.params.taskId);
    const att = task.attachments.id(req.params.attId);
    if (!att) throw httpError(404, 'File not found');
    const full = path.join(STORAGE, att.filePath);
    if (!full.startsWith(STORAGE) || !fs.existsSync(full)) throw httpError(404, 'File not found');
    res.download(full, att.fileName);
  } catch (err) { sendError(res, err, 'Error downloading file'); }
});

router.delete('/:taskId/attachments/:attId', async (req, res) => {
  try {
    const { task } = await loadTask(req, req.params.taskId, { forWrite: true });
    const att = task.attachments.id(req.params.attId);
    if (!att) throw httpError(404, 'File not found');
    const full = path.join(STORAGE, att.filePath);
    if (full.startsWith(STORAGE) && fs.existsSync(full)) fs.unlinkSync(full);
    task.history.push({ at: new Date(), by: req.user._id, field: 'attachment', from: att.fileName, note: 'File removed' });
    att.deleteOne();
    await task.save();
    emitUpdated(req, [task.voyage]);
    res.json(await taskOut(task._id));
  } catch (err) { sendError(res, err, 'Error removing file'); }
});

module.exports = router;
module.exports.STORAGE = STORAGE;
