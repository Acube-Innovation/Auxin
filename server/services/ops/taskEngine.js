// Task generation and recalculation for voyages (Development Scope 5.3–5.4, features B9, D3, D4, D7).
const mongoose = require('mongoose');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const VoyageTask = require('../../models/ops/VoyageTask');
const TaskTemplate = require('../../models/ops/TaskTemplate');
const OpsStage = require('../../models/ops/OpsStage');
const User = require('../../models/User');
const engine = require('./dueDateEngine');
const { deriveVesselStatus } = require('./vesselStatus');
const { DUE_SOON_DAYS } = require('./config');
const { DateTime } = require('luxon');

const OPEN = ['NOT_STARTED', 'INITIATED', 'AWAITING'];
const idOf = (v) => (v ? String(v._id || v) : null);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Run fn(session) in a MongoDB transaction (Atlas and the local replica set both support them)
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function loadContext(voyageId, session) {
  const voyage = await Voyage.findById(voyageId).session(session || null);
  if (!voyage) throw Object.assign(new Error('Voyage not found'), { status: 404 });
  const portCalls = await PortCall.find({ voyage: voyage._id }).populate('port', 'name').sort({ seq: 1 }).session(session || null);
  return { voyage, portCalls };
}

const sortKeyOf = (stage, pc, template) => (stage ? stage.order : 99) * 1e6 + (pc ? pc.seq : 0) * 1e4 + (template ? template.sortOrder || 0 : 9999);

// Default assignees: employees of users with the template's default role who operate this voyage,
// otherwise the voyage operators (feature D8; defaults pending the client's "who does the work" answer)
async function assigneeResolver(voyage, session) {
  const operators = (voyage.operators || []).map(idOf);
  const cache = new Map();
  return async (role) => {
    if (!role) return operators;
    if (!cache.has(role)) {
      const users = await User.find({ role, employeeId: { $ne: null } }).select('employeeId').session(session || null).lean();
      const matches = users.map((u) => idOf(u.employeeId)).filter((e) => operators.includes(e));
      cache.set(role, matches.length ? matches : operators);
    }
    return cache.get(role);
  };
}

// Build (not save) the template tasks for a voyage — for every active port call, or only `onlyPortCall`
async function buildTemplateTasks(voyage, portCalls, { session, onlyPortCall = null } = {}) {
  const stages = await OpsStage.find({ isActive: true }).session(session || null).lean();
  const stageById = new Map(stages.map((s) => [idOf(s), s]));
  const templates = await TaskTemplate.find({ isActive: true }).session(session || null).lean();
  const activeCalls = portCalls.filter((pc) => pc.status !== 'CANCELLED');
  const assignees = await assigneeResolver(voyage, session);
  const tasks = [];

  for (const t of templates) {
    const stage = stageById.get(idOf(t.stage));
    if (!stage) continue;
    if (t.voyageTypes && t.voyageTypes.length && !t.voyageTypes.includes(voyage.voyageType)) continue;
    const recurring = Boolean(t.recurrence && t.recurrence.everyDays);
    const calls = stage.scope === 'PORT_CALL'
      ? activeCalls.filter((pc) => pc.type === stage.portType && (!onlyPortCall || idOf(pc) === idOf(onlyPortCall)))
      : (onlyPortCall ? [] : [null]);
    for (const pc of calls) {
      const portName = pc && pc.port && pc.port.name;
      tasks.push({
        voyage: voyage._id,
        portCall: pc ? pc._id : null,
        template: t._id,
        code: t.code,
        name: portName ? `${portName} – ${t.name}` : t.name,
        baseName: t.name,
        instructions: t.instructions,
        stage: stage._id,
        sortKey: sortKeyOf(stage, pc, t),
        anchor: { event: t.anchor.event, basis: t.anchor.basis || 'BEST' },
        offsetDays: t.offsetDays,
        recurrence: { everyDays: t.recurrence?.everyDays || null, until: t.recurrence?.until || null },
        recurrenceIndex: recurring ? 0 : null,
        dueDate: engine.dueDateFor(t, voyage, pc, portCalls, recurring ? 0 : null),
        priority: t.defaultPriority || 'MEDIUM',
        reminderProfile: t.reminderProfile || t.defaultPriority || 'MEDIUM',
        isOptional: Boolean(t.isOptional),
        linkedField: t.linkedField || null,
        autoCompleteOnField: Boolean(t.autoCompleteOnField),
        assignedTo: await assignees(t.defaultRole),
        _stage: { _id: stage._id, code: stage.code, name: stage.name, order: stage.order, scope: stage.scope },
        _portCall: pc ? { _id: pc._id, seq: pc.seq, type: pc.type, port: portName } : null,
      });
    }
  }
  return tasks.sort((a, b) => a.sortKey - b.sortKey);
}

const keyOf = (code, portCallId) => `${code}:${portCallId ? idOf(portCallId) : ''}`;

// ------------------------------------------------------------------ preview (B9)
async function preview(voyageId) {
  const { voyage, portCalls } = await loadContext(voyageId);
  const tasks = await buildTemplateTasks(voyage, portCalls);
  return tasks.map((t) => ({
    key: keyOf(t.code, t.portCall),
    code: t.code,
    name: t.name,
    stage: t._stage,
    portCall: t._portCall,
    anchor: t.anchor,
    offsetDays: t.offsetDays,
    recurrence: t.recurrence,
    dueDate: t.dueDate,
    priority: t.priority,
    isOptional: t.isOptional,
    included: !t.isOptional,
  }));
}

// Ad-hoc task (D7): { name, dueDate? 'YYYY-MM-DD' | anchor + offsetDays, priority, stage?, portCall? }
function buildAdhocTask(input, voyage, portCalls, stagesById, user) {
  const name = String(input.name || '').trim();
  if (!name) throw badRequest('An ad-hoc task needs a name');
  const pc = input.portCall ? portCalls.find((p) => idOf(p) === idOf(input.portCall)) : null;
  if (input.portCall && !pc) throw badRequest(`Ad-hoc task "${name}": port call not found in this voyage`);
  const stage = input.stage ? stagesById.get(idOf(input.stage)) : null;
  let dueDate = null;
  let dueOverridden = false;
  let anchor = { event: null, basis: 'BEST' };
  let offsetDays = 0;
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw badRequest(`Ad-hoc task "${name}": due date must be YYYY-MM-DD`);
    dueDate = input.dueDate;
    dueOverridden = true;
  } else if (input.anchor && input.anchor.event) {
    anchor = { event: input.anchor.event, basis: input.anchor.basis || 'BEST' };
    offsetDays = parseInt(input.offsetDays, 10) || 0;
    dueDate = engine.dueDateFor({ anchor, offsetDays }, voyage, pc, portCalls);
  }
  const priority = ['HIGH', 'MEDIUM', 'LOW'].includes(input.priority) ? input.priority : 'MEDIUM';
  return {
    voyage: voyage._id,
    portCall: pc ? pc._id : null,
    template: null,
    code: null,
    name: pc ? `${pc.port?.name} – ${name}` : name,
    baseName: name,
    stage: stage ? stage._id : null,
    sortKey: sortKeyOf(stage, pc, null),
    anchor,
    offsetDays,
    dueDate,
    dueOverridden,
    priority,
    reminderProfile: priority,
    assignedTo: (voyage.operators || []).map(idOf),
    history: [{ at: new Date(), by: user._id, field: 'created', note: 'Ad-hoc task added at voyage creation' }],
    createdBy: user._id,
  };
}

// ------------------------------------------------------------------ activate (B9)
// excluded: [{ code, portCall, reason }]; adhocTasks: see buildAdhocTask
async function activate(voyageId, { excluded = [], adhocTasks = [] } = {}, user) {
  return withTransaction(async (session) => {
    const { voyage, portCalls } = await loadContext(voyageId, session);
    if (voyage.status !== 'DRAFT') throw badRequest(`Only a draft voyage can be activated (this one is ${voyage.status.toLowerCase()})`);
    if (!portCalls.some((pc) => pc.status !== 'CANCELLED')) throw badRequest('Add at least one port call before activating');
    if (await VoyageTask.exists({ voyage: voyage._id }).session(session)) throw badRequest('This voyage already has tasks');

    const tasks = await buildTemplateTasks(voyage, portCalls, { session });
    const byKey = new Map(tasks.map((t) => [keyOf(t.code, t.portCall), t]));
    for (const ex of excluded) {
      const task = byKey.get(keyOf(ex.code, ex.portCall));
      if (!task) throw badRequest(`Unknown task ${ex.code}${ex.portCall ? ' for that port call' : ''} in the excluded list`);
      task.status = 'NA';
      task.naReason = String(ex.reason || '').trim() || 'Removed at voyage creation';
    }
    const now = new Date();
    const docs = tasks.map(({ _stage, _portCall, ...t }) => ({
      ...t,
      history: [{ at: now, by: user._id, field: 'created', note: t.status === 'NA' ? `Generated as Not applicable: ${t.naReason}` : 'Generated at voyage activation' }],
      createdBy: user._id,
    }));
    const stagesById = new Map((await OpsStage.find().session(session).lean()).map((s) => [idOf(s), s]));
    for (const a of adhocTasks) docs.push(buildAdhocTask(a, voyage, portCalls, stagesById, user));
    await VoyageTask.insertMany(docs, { session });

    // Freeze the original plan (feature C3)
    voyage.delivery.original = voyage.delivery.estimated || null;
    voyage.redelivery.original = voyage.redelivery.estimated || null;
    for (const pc of portCalls) {
      if (pc.status === 'CANCELLED') continue;
      pc.original = { eta: pc.planned.eta, etb: pc.planned.etb, etc: pc.planned.etc, ets: pc.planned.ets };
      await pc.save({ session });
    }
    voyage.status = 'ACTIVE';
    voyage.vesselStatus = deriveVesselStatus(voyage, portCalls);
    voyage.updatedBy = user._id;
    await voyage.save({ session });
    return {
      created: docs.length,
      notApplicable: docs.filter((d) => d.status === 'NA').length,
      adhoc: adhocTasks.length,
      awaitingDate: docs.filter((d) => d.status !== 'NA' && !d.dueDate).length,
    };
  });
}

// ------------------------------------------------------------------ recalculation (D4)
// Recompute the due date of every open task whose date was not set by hand. Done and N/A tasks never move.
async function recalculate(voyageId, { session, user = null, reason = '' } = {}) {
  const { voyage, portCalls } = await loadContext(voyageId, session);
  const tasks = await VoyageTask.find({ voyage: voyage._id, status: { $in: OPEN } }).session(session || null);
  const callById = new Map(portCalls.map((pc) => [idOf(pc), pc]));
  const stageOrder = new Map((await OpsStage.find().session(session || null).select('order').lean()).map((s) => [idOf(s), s]));
  const now = new Date();
  const moved = [];
  const ops = [];

  for (const t of tasks) {
    const pc = t.portCall ? callById.get(idOf(t.portCall)) : null;
    const update = {};
    // Keep the sort order in step with the rotation (port calls can be re-ordered)
    if (pc) {
      const key = sortKeyOf(stageOrder.get(idOf(t.stage)), pc, { sortOrder: t.sortKey % 1e4 });
      if (key !== t.sortKey) update.sortKey = key;
    }
    if (!t.dueOverridden && t.anchor && t.anchor.event) {
      const next = engine.dueDateFor(t, voyage, pc, portCalls, t.recurrenceIndex);
      if (next !== t.dueDate) {
        update.dueDate = next;
        update.reminderSent = [];
        moved.push({ id: t._id, code: t.code, name: t.name, from: t.dueDate, to: next });
        ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: update, $push: { history: { at: now, by: user ? user._id : null, field: 'dueDate', from: t.dueDate, to: next, note: reason || 'Recalculated after a key date changed' } } } } });
        continue;
      }
    }
    if (Object.keys(update).length) ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: update } } });
  }
  if (ops.length) await VoyageTask.bulkWrite(ops, { session });

  const today = engine.todayIn();
  const soonLimit = DateTime.fromISO(today).plus({ days: DUE_SOON_DAYS }).toISODate();
  const dueSoon = moved.filter((m) => m.to && m.to <= soonLimit);
  return { movedTasks: moved, dueSoon };
}

// ------------------------------------------------------------------ port calls added / cancelled on an active voyage
async function addPortCallTasks(voyageId, portCallId, { session, user }) {
  const { voyage, portCalls } = await loadContext(voyageId, session);
  if (voyage.status !== 'ACTIVE') return 0;
  const pc = portCalls.find((p) => idOf(p) === idOf(portCallId));
  const tasks = await buildTemplateTasks(voyage, portCalls, { session, onlyPortCall: pc });
  const now = new Date();
  const docs = tasks.map(({ _stage, _portCall, ...t }) => ({
    ...t, history: [{ at: now, by: user._id, field: 'created', note: 'Generated when the port call was added' }], createdBy: user._id,
  }));
  if (docs.length) await VoyageTask.insertMany(docs, { session });
  pc.original = { eta: pc.planned.eta, etb: pc.planned.etb, etc: pc.planned.etc, ets: pc.planned.ets };
  await pc.save({ session });
  return docs.length;
}

async function cancelPortCallTasks(portCallId, { session, user }) {
  const res = await VoyageTask.updateMany(
    { portCall: portCallId, status: { $in: OPEN } },
    { $set: { status: 'NA', naReason: 'Port call cancelled' }, $push: { history: { at: new Date(), by: user._id, field: 'status', to: 'NA', note: 'Port call cancelled' } } },
    { session },
  );
  return res.modifiedCount;
}

async function refreshVesselStatus(voyageId, { session }) {
  const { voyage, portCalls } = await loadContext(voyageId, session);
  const status = deriveVesselStatus(voyage, portCalls);
  if (voyage.vesselStatus !== status) {
    voyage.vesselStatus = status;
    await voyage.save({ session });
  }
  return status;
}

module.exports = {
  withTransaction, preview, activate, recalculate, addPortCallTasks, cancelPortCallTasks, refreshVesselStatus, buildTemplateTasks, OPEN,
};
