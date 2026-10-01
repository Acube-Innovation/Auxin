// Masters for the Vessel Operations module (features A1–A5).
// Read: every operations role (enforced in routes/ops/index.js). Write: see requireRole on each route.
const express = require('express');
const router = express.Router();
const requireRole = require('../../middleware/requireRole');
const { ADMIN, MANAGERS } = require('../../services/ops/roles');
const constants = require('../../services/ops/constants');
const { OFFICE_TZ } = require('../../services/ops/config');
const Vessel = require('../../models/ops/Vessel');
const Port = require('../../models/ops/Port');
const OpsStage = require('../../models/ops/OpsStage');
const TaskTemplate = require('../../models/ops/TaskTemplate');
const DailyCheckTemplate = require('../../models/ops/DailyCheckTemplate');
const { pick, sendError, escapeRegex, httpError } = require('./helpers');
const { vesselUsage, portUsage } = require('../../services/ops/references');

const adminOnly = requireRole(ADMIN);
const templateEditors = requireRole([...ADMIN, ...MANAGERS]);
const CLIENT_FIELDS = 'companyName clientType';

// ---------------------------------------------------------------- meta
// Enums and labels for the UI, so the frontend never hard-codes them.
router.get('/meta', (req, res) => {
  res.json({
    portTypes: constants.PORT_TYPES,
    stageScopes: constants.STAGE_SCOPES,
    priorities: constants.PRIORITIES,
    reminderProfiles: constants.REMINDER_PROFILES,
    voyageTypes: constants.VOYAGE_TYPES,
    sourceTags: constants.SOURCE_TAGS,
    anchorBases: constants.ANCHOR_BASES,
    anchorEvents: constants.ANCHOR_EVENTS,
    vesselStatuses: constants.VESSEL_STATUSES,
    linkedFields: constants.LINKED_FIELDS,
    userRoles: require('../../models/User').schema.path('role').enumValues,
    officeTimeZone: OFFICE_TZ,
    voyageStatuses: require('../../models/ops/Voyage').VOYAGE_STATUSES,
    canEdit: {
      vessels: ADMIN.includes(req.user.role),
      ports: ADMIN.includes(req.user.role),
      stages: ADMIN.includes(req.user.role),
      dailyChecks: ADMIN.includes(req.user.role),
      taskTemplates: [...ADMIN, ...MANAGERS].includes(req.user.role),
    },
  });
});

// ---------------------------------------------------------------- vessels (A1)
const VESSEL_FIELDS = ['name', 'imo', 'type', 'dwt', 'flag', 'yearBuilt', 'owners', 'ownersBroker', 'notes', 'isActive'];

router.get('/vessels', async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.search) {
      const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
      filter.$or = [{ name: rx }, { imo: rx }];
    }
    const vessels = await Vessel.find(filter)
      .populate('owners', CLIENT_FIELDS)
      .populate('ownersBroker', CLIENT_FIELDS)
      .sort({ name: 1 })
      .collation({ locale: 'en' })
      .lean();
    res.json(vessels);
  } catch (err) { sendError(res, err, 'Error fetching vessels'); }
});

router.get('/vessels/:id', async (req, res) => {
  try {
    const vessel = await Vessel.findById(req.params.id).populate('owners', CLIENT_FIELDS).populate('ownersBroker', CLIENT_FIELDS);
    if (!vessel) return res.status(404).json({ message: 'Vessel not found' });
    res.json(vessel);
  } catch (err) { sendError(res, err, 'Error fetching vessel'); }
});

router.post('/vessels', adminOnly, async (req, res) => {
  try {
    const vessel = await Vessel.create({ ...pick(req.body, VESSEL_FIELDS), createdBy: req.user._id, updatedBy: req.user._id });
    res.status(201).json(vessel);
  } catch (err) { sendError(res, err, 'Error creating vessel'); }
});

router.put('/vessels/:id', adminOnly, async (req, res) => {
  try {
    const vessel = await Vessel.findById(req.params.id);
    if (!vessel) return res.status(404).json({ message: 'Vessel not found' });
    Object.assign(vessel, pick(req.body, VESSEL_FIELDS), { updatedBy: req.user._id });
    await vessel.save();
    res.json(vessel);
  } catch (err) { sendError(res, err, 'Error updating vessel'); }
});

// Refused while a (non-cancelled) voyage uses the vessel — deactivate it instead.
router.delete('/vessels/:id', adminOnly, async (req, res) => {
  try {
    const usage = await vesselUsage(req.params.id);
    if (usage) throw httpError(400, `${usage}. Untick "Active" instead of deleting.`);
    const vessel = await Vessel.findByIdAndDelete(req.params.id);
    if (!vessel) return res.status(404).json({ message: 'Vessel not found' });
    res.json({ message: 'Vessel deleted' });
  } catch (err) { sendError(res, err, 'Error deleting vessel'); }
});

// ---------------------------------------------------------------- ports (A2)
const PORT_FIELDS = ['name', 'country', 'unlocode', 'timeZone', 'defaultAgents', 'notes', 'isActive'];

router.get('/ports', async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.search) {
      const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
      filter.$or = [{ name: rx }, { country: rx }, { unlocode: rx }];
    }
    const ports = await Port.find(filter).populate('defaultAgents', CLIENT_FIELDS).sort({ name: 1 }).collation({ locale: 'en' }).lean();
    res.json(ports);
  } catch (err) { sendError(res, err, 'Error fetching ports'); }
});

router.get('/ports/:id', async (req, res) => {
  try {
    const port = await Port.findById(req.params.id).populate('defaultAgents', CLIENT_FIELDS);
    if (!port) return res.status(404).json({ message: 'Port not found' });
    res.json(port);
  } catch (err) { sendError(res, err, 'Error fetching port'); }
});

router.post('/ports', adminOnly, async (req, res) => {
  try {
    const port = await Port.create({ ...pick(req.body, PORT_FIELDS), createdBy: req.user._id, updatedBy: req.user._id });
    res.status(201).json(port);
  } catch (err) { sendError(res, err, 'Error creating port'); }
});

router.put('/ports/:id', adminOnly, async (req, res) => {
  try {
    const port = await Port.findById(req.params.id);
    if (!port) return res.status(404).json({ message: 'Port not found' });
    Object.assign(port, pick(req.body, PORT_FIELDS), { updatedBy: req.user._id });
    await port.save();
    res.json(port);
  } catch (err) { sendError(res, err, 'Error updating port'); }
});

router.delete('/ports/:id', adminOnly, async (req, res) => {
  try {
    const usage = await portUsage(req.params.id);
    if (usage) throw httpError(400, `${usage}. Untick "Active" instead of deleting.`);
    const port = await Port.findByIdAndDelete(req.params.id);
    if (!port) return res.status(404).json({ message: 'Port not found' });
    res.json({ message: 'Port deleted' });
  } catch (err) { sendError(res, err, 'Error deleting port'); }
});

// ---------------------------------------------------------------- stages (A3)
const STAGE_FIELDS = ['code', 'name', 'order', 'scope', 'portType', 'isActive'];

router.get('/stages', async (req, res) => {
  try {
    const stages = await OpsStage.find().sort({ order: 1 }).lean();
    const counts = await TaskTemplate.aggregate([{ $group: { _id: '$stage', total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } }]);
    const byStage = new Map(counts.map((c) => [String(c._id), c]));
    res.json(stages.map((s) => ({ ...s, templateCount: byStage.get(String(s._id))?.total || 0, activeTemplateCount: byStage.get(String(s._id))?.active || 0 })));
  } catch (err) { sendError(res, err, 'Error fetching stages'); }
});

// { ids: [stageId, ...] } in the new order. Declared before /stages/:id.
router.put('/stages/reorder', adminOnly, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ message: 'ids is required' });
    await OpsStage.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i + 1 } } } })));
    res.json(await OpsStage.find().sort({ order: 1 }));
  } catch (err) { sendError(res, err, 'Error re-ordering stages'); }
});

router.post('/stages', adminOnly, async (req, res) => {
  try {
    const data = pick(req.body, STAGE_FIELDS);
    if (data.order === undefined) {
      const last = await OpsStage.findOne().sort({ order: -1 });
      data.order = (last?.order || 0) + 1;
    }
    if (data.scope === 'VOYAGE') data.portType = null;
    res.status(201).json(await OpsStage.create(data));
  } catch (err) { sendError(res, err, 'Error creating stage'); }
});

router.put('/stages/:id', adminOnly, async (req, res) => {
  try {
    const stage = await OpsStage.findById(req.params.id);
    if (!stage) return res.status(404).json({ message: 'Stage not found' });
    Object.assign(stage, pick(req.body, STAGE_FIELDS.filter((f) => f !== 'code')));
    if (stage.scope === 'VOYAGE') stage.portType = null;
    await stage.save();
    res.json(stage);
  } catch (err) { sendError(res, err, 'Error updating stage'); }
});

router.delete('/stages/:id', adminOnly, async (req, res) => {
  try {
    const inUse = await TaskTemplate.countDocuments({ stage: req.params.id });
    if (inUse > 0) throw httpError(400, `This stage has ${inUse} task template(s). Move or deactivate them first, or deactivate the stage.`);
    const stage = await OpsStage.findByIdAndDelete(req.params.id);
    if (!stage) return res.status(404).json({ message: 'Stage not found' });
    res.json({ message: 'Stage deleted' });
  } catch (err) { sendError(res, err, 'Error deleting stage'); }
});

// ---------------------------------------------------------------- task templates (A4)
const TEMPLATE_FIELDS = [
  'name', 'instructions', 'stage', 'anchor', 'offsetDays', 'recurrence', 'defaultPriority', 'reminderProfile',
  'defaultRole', 'isOptional', 'linkedField', 'autoCompleteOnField', 'voyageTypes', 'sortOrder', 'isActive',
];

function normaliseTemplate(data) {
  if (data.recurrence && !data.recurrence.everyDays) data.recurrence = { everyDays: null, until: null };
  if (data.linkedField === '') data.linkedField = null;
  if (data.defaultRole === '') data.defaultRole = null;
  if (data.offsetDays !== undefined) data.offsetDays = Number(data.offsetDays);
  return data;
}

router.get('/task-templates', async (req, res) => {
  try {
    const filter = {};
    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.source) filter.sourceTag = req.query.source;
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;
    if (req.query.search) {
      const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
      filter.$or = [{ name: rx }, { code: rx }];
    }
    const templates = await TaskTemplate.find(filter).populate('stage', 'code name order scope portType').lean();
    templates.sort((a, b) => (a.stage?.order ?? 999) - (b.stage?.order ?? 999) || a.sortOrder - b.sortOrder);
    res.json(templates);
  } catch (err) { sendError(res, err, 'Error fetching task templates'); }
});

// { stage, ids: [templateId, ...] } — new order within one stage. Declared before /:id.
router.put('/task-templates/reorder', templateEditors, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ message: 'ids is required' });
    await TaskTemplate.bulkWrite(ids.map((id, i) => ({
      updateOne: { filter: { _id: id }, update: { $set: { sortOrder: (i + 1) * 10, updatedBy: req.user._id } } },
    })));
    res.json({ message: 'Order saved' });
  } catch (err) { sendError(res, err, 'Error re-ordering task templates'); }
});

router.get('/task-templates/:id', async (req, res) => {
  try {
    const template = await TaskTemplate.findById(req.params.id).populate('stage', 'code name order scope portType');
    if (!template) return res.status(404).json({ message: 'Task template not found' });
    res.json(template);
  } catch (err) { sendError(res, err, 'Error fetching task template'); }
});

router.post('/task-templates', templateEditors, async (req, res) => {
  try {
    const data = normaliseTemplate(pick(req.body, TEMPLATE_FIELDS));
    // Next free code T### unless one is given
    let code = String(req.body.code || '').trim().toUpperCase();
    if (!code) {
      const codes = await TaskTemplate.find({ code: /^T\d+$/ }).select('code').lean();
      const max = codes.reduce((m, t) => Math.max(m, parseInt(t.code.slice(1), 10)), 0);
      code = `T${String(max + 1).padStart(3, '0')}`;
    }
    if (data.sortOrder === undefined && data.stage) {
      const last = await TaskTemplate.findOne({ stage: data.stage }).sort({ sortOrder: -1 });
      data.sortOrder = (last?.sortOrder || 0) + 10;
    }
    if (!data.reminderProfile && data.defaultPriority) data.reminderProfile = data.defaultPriority;
    const template = await TaskTemplate.create({ ...data, code, sourceTag: 'USER', updatedBy: req.user._id });
    res.status(201).json(await template.populate('stage', 'code name order scope portType'));
  } catch (err) { sendError(res, err, 'Error creating task template'); }
});

router.put('/task-templates/:id', templateEditors, async (req, res) => {
  try {
    const template = await TaskTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Task template not found' });
    const data = normaliseTemplate(pick(req.body, TEMPLATE_FIELDS));
    if (data.defaultPriority && data.defaultPriority !== template.defaultPriority) data.priorityDefaulted = false;
    Object.assign(template, data, { updatedBy: req.user._id });
    await template.save();
    res.json(await template.populate('stage', 'code name order scope portType'));
  } catch (err) { sendError(res, err, 'Error updating task template'); }
});
// No DELETE: templates are deactivated (isActive=false) so voyage tasks keep their origin (feature A4).

// ---------------------------------------------------------------- daily check sets (A5)
router.get('/daily-check-templates', async (req, res) => {
  try {
    const docs = await DailyCheckTemplate.find().lean();
    const order = constants.VESSEL_STATUS_VALUES;
    docs.sort((a, b) => order.indexOf(a.vesselStatus) - order.indexOf(b.vesselStatus));
    docs.forEach((d) => d.items.sort((a, b) => a.order - b.order));
    res.json(docs);
  } catch (err) { sendError(res, err, 'Error fetching daily check sets'); }
});

// Replace the item list of one vessel status: { items: [{ _id?, code?, name, linkedField, isActive }] }
router.put('/daily-check-templates/:vesselStatus', adminOnly, async (req, res) => {
  try {
    const status = req.params.vesselStatus;
    if (!constants.VESSEL_STATUS_VALUES.includes(status)) return res.status(400).json({ message: `Unknown vessel status ${status}` });
    const incoming = Array.isArray(req.body.items) ? req.body.items : [];
    let doc = await DailyCheckTemplate.findOne({ vesselStatus: status });
    if (!doc) doc = new DailyCheckTemplate({ vesselStatus: status, items: [] });

    const existing = new Map(doc.items.map((i) => [String(i._id), i]));
    const usedCodes = new Set();
    let seq = doc.items.length;
    doc.items = incoming.map((item, index) => {
      const prev = item._id ? existing.get(String(item._id)) : null;
      let code = prev?.code || item.code;
      if (!code || usedCodes.has(code)) code = `${status}_${++seq}`;
      usedCodes.add(code);
      return {
        _id: prev?._id,
        code,
        name: item.name,
        order: index + 1,
        linkedField: item.linkedField || null,
        sourceTag: prev?.sourceTag || 'USER',
        sourceNote: prev?.sourceNote,
        isActive: item.isActive !== false,
      };
    });
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json(doc);
  } catch (err) { sendError(res, err, 'Error saving daily check set'); }
});

module.exports = router;
