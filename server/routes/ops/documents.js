// Voyage documents (feature I2): /api/ops/voyages/:id/documents
// Unlike the Phase 1 /api/documents routes, every call needs a login and access to the voyage, files are
// stored outside the public uploads folder, the uploader comes from the login, and delete removes the file.
const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const VoyageTask = require('../../models/ops/VoyageTask');
const VoyageDocument = require('../../models/ops/VoyageDocument');
const VoyageLog = require('../../models/ops/VoyageLog');
const access = require('../../services/ops/accessScope');
const { badRequest } = require('../../services/ops/voyageInput');
const { sendError, httpError } = require('./helpers');
const { STORAGE } = require('./tasks');

const MAX_MB = 25;
const MAX_FILES = 10;
const ALLOWED = /\.(pdf|docx?|xlsx?|csv|txt|rtf|odt|ods|pptx?|jpe?g|png|gif|webp|tiff?|msg|eml|zip)$/i;
const CATEGORY = Object.fromEntries(VoyageDocument.CATEGORIES.map((c) => [c.value, c.label]));

async function loadVoyage(req, forWrite) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Voyage not found');
  const voyage = await Voyage.findById(req.params.id);
  if (!voyage || !(await access.canView(req.user, voyage))) throw httpError(404, 'Voyage not found');
  if (forWrite) {
    if (!(await access.canEdit(req.user, voyage))) throw httpError(403, 'You cannot change documents of this voyage');
    if (voyage.status === 'CANCELLED') throw badRequest('Documents of a cancelled voyage cannot be changed');
  }
  return voyage;
}

async function checkPortCall(voyage, portCall) {
  if (!portCall) return null;
  if (!mongoose.isValidObjectId(portCall) || !(await PortCall.exists({ _id: portCall, voyage: voyage._id }))) throw badRequest('The port call is not part of this voyage');
  return portCall;
}

const POPULATE = [
  { path: 'uploadedBy', select: 'username' },
  { path: 'updatedBy', select: 'username' },
  { path: 'portCall', select: 'seq type port', populate: { path: 'port', select: 'name' } },
];

// List: the voyage's documents, and the files attached to its tasks (read-only here)
router.get('/', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, false);
    const [documents, tasks] = await Promise.all([
      VoyageDocument.find({ voyage: voyage._id }).populate(POPULATE).sort({ createdAt: -1 }).lean(),
      VoyageTask.find({ voyage: voyage._id, 'attachments.0': { $exists: true } }).select('name code attachments').populate('attachments.uploadedBy', 'username').lean(),
    ]);
    const taskFiles = tasks.flatMap((t) => t.attachments.map((a) => ({ ...a, taskId: t._id, task: t.name, code: t.code })))
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({
      documents,
      taskFiles,
      categories: VoyageDocument.CATEGORIES,
      canEdit: voyage.status !== 'CANCELLED' && (await access.canEdit(req.user, voyage)),
      maxMb: MAX_MB,
    });
  } catch (err) { sendError(res, err, 'Error fetching documents'); }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(STORAGE, String(req.params.id), 'documents');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${file.originalname.replace(/[^\w.\- ]+/g, '_')}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter: (req, file, cb) => (ALLOWED.test(file.originalname) ? cb(null, true) : cb(badRequest(`${file.originalname}: this file type is not accepted`))),
});

// Upload one or more files (field "files"); category / portCall / notes apply to all of them
router.post('/', async (req, res, next) => {
  try { await loadVoyage(req, true); next(); } catch (err) { sendError(res, err, 'Error uploading documents'); }
}, (req, res, next) => upload.array('files', MAX_FILES)(req, res, (err) => {
  if (!err) return next();
  const message = err.code === 'LIMIT_FILE_SIZE' ? `Files can be at most ${MAX_MB} MB` : err.code === 'LIMIT_FILE_COUNT' ? `At most ${MAX_FILES} files at a time` : err.message;
  return res.status(400).json({ message });
}), async (req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) throw badRequest('Choose at least one file');
    const voyage = await Voyage.findById(req.params.id);
    const category = req.body.category || 'OTHER';
    if (!CATEGORY[category]) throw badRequest('Unknown document category');
    const portCall = await checkPortCall(voyage, req.body.portCall || null);
    const docs = await VoyageDocument.insertMany(files.map((f) => ({
      voyage: voyage._id, category, portCall, notes: req.body.notes || '',
      title: files.length === 1 && req.body.title ? req.body.title : '',
      fileName: f.originalname, filePath: path.relative(STORAGE, f.path), fileType: f.mimetype, fileSize: f.size,
      uploadedBy: req.user._id, userRole: req.user.role,
    })));
    await VoyageLog.write(voyage._id, req.user, 'DOCUMENT', `${CATEGORY[category]}: ${files.map((f) => f.originalname).join(', ')} uploaded`);
    const io = req.app.get('io');
    if (io) io.to(`voyage-${voyage._id}`).emit('ops-voyage-updated', { voyageId: String(voyage._id), what: 'documents', by: String(req.user._id), byName: req.user.username });
    res.status(201).json(await VoyageDocument.find({ _id: { $in: docs.map((d) => d._id) } }).populate(POPULATE).lean());
  } catch (err) {
    for (const f of files) fs.rm(f.path, { force: true }, () => {});
    sendError(res, err, 'Error uploading documents');
  }
});

async function loadDoc(req, voyage) {
  if (!mongoose.isValidObjectId(req.params.docId)) throw httpError(404, 'Document not found');
  const doc = await VoyageDocument.findOne({ _id: req.params.docId, voyage: voyage._id });
  if (!doc) throw httpError(404, 'Document not found');
  return doc;
}

router.get('/:docId/download', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, false);
    const doc = await loadDoc(req, voyage);
    const full = path.join(STORAGE, doc.filePath);
    if (!full.startsWith(STORAGE) || !fs.existsSync(full)) throw httpError(404, 'The file is missing on the server');
    if (req.query.inline) res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    if (req.query.inline) return res.type(doc.fileType || 'application/octet-stream').sendFile(full);
    return res.download(full, doc.fileName);
  } catch (err) { return sendError(res, err, 'Error downloading document'); }
});

// Edit the details (not the file)
router.patch('/:docId', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const doc = await loadDoc(req, voyage);
    if (req.body.category !== undefined) {
      if (!CATEGORY[req.body.category]) throw badRequest('Unknown document category');
      doc.category = req.body.category;
    }
    if (req.body.title !== undefined) doc.title = String(req.body.title || '').slice(0, 200);
    if (req.body.notes !== undefined) doc.notes = String(req.body.notes || '').slice(0, 2000);
    if (req.body.portCall !== undefined) doc.portCall = await checkPortCall(voyage, req.body.portCall || null);
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json(await VoyageDocument.findById(doc._id).populate(POPULATE).lean());
  } catch (err) { sendError(res, err, 'Error updating document'); }
});

router.delete('/:docId', async (req, res) => {
  try {
    const voyage = await loadVoyage(req, true);
    const doc = await loadDoc(req, voyage);
    const full = path.join(STORAGE, doc.filePath);
    if (full.startsWith(STORAGE)) fs.rmSync(full, { force: true });
    await doc.deleteOne();
    await VoyageLog.write(voyage._id, req.user, 'DOCUMENT', `${CATEGORY[doc.category]}: ${doc.fileName} deleted`);
    const io = req.app.get('io');
    if (io) io.to(`voyage-${voyage._id}`).emit('ops-voyage-updated', { voyageId: String(voyage._id), what: 'documents', by: String(req.user._id), byName: req.user.username });
    res.json({ message: `${doc.fileName} deleted` });
  } catch (err) { sendError(res, err, 'Error deleting document'); }
});

module.exports = router;
