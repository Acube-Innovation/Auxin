// Changes people make to voyage tasks (features D1, D2, D4, D6, D8, D10, C5).
const mongoose = require('mongoose');
const Employee = require('../../models/Employee');
const PortCall = require('../../models/ops/PortCall');
const Voyage = require('../../models/ops/Voyage');
const engine = require('./dueDateEngine');
const { applySuggestions } = require('./suggestions');
const { assertPortCallOrder } = require('./voyageInput');
const { parseInstant } = require('./time');
const { OFFICE_TZ } = require('./config');
const { TASK_STATUSES } = require('../../models/ops/VoyageTask');
const { stopOnClose } = require('./taskTimer');

const OPEN = ['NOT_STARTED', 'INITIATED', 'AWAITING'];
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Apply a patch to a task document (not saved). Returns the list of changes for the history.
// patch: { status, naReason, startDate, completedDate, dueDate, unlockDueDate, priority, assignedTo, remarks, plannedHours }
async function applyTaskPatch(task, patch, { session } = {}) {
  const changes = [];
  const set = (field, value) => {
    const before = task[field];
    const same = Array.isArray(before) ? JSON.stringify(before.map(String)) === JSON.stringify((value || []).map(String)) : String(before ?? '') === String(value ?? '');
    if (!same) {
      changes.push({ field, from: Array.isArray(before) ? before.map(String) : before ?? null, to: value ?? null });
      task[field] = value;
    }
  };
  const today = engine.todayIn();

  if (patch.priority !== undefined) {
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(patch.priority)) throw badRequest('priority must be HIGH, MEDIUM or LOW');
    // Reminders follow the priority unless the template gave the task its own reminder profile (F2)
    if (task.reminderProfile === task.priority) task.reminderProfile = patch.priority;
    set('priority', patch.priority);
  }
  if (patch.remarks !== undefined) set('remarks', String(patch.remarks || ''));
  if (patch.plannedHours !== undefined) {
    const h = patch.plannedHours === null || patch.plannedHours === '' ? null : Number(patch.plannedHours);
    if (h !== null && !(Number.isFinite(h) && h >= 0)) throw badRequest('Planned hours must be a number of 0 or more');
    set('plannedHours', h);
  }
  if (patch.assignedTo !== undefined) {
    if (!Array.isArray(patch.assignedTo)) throw badRequest('assignedTo must be a list');
    const ids = [...new Set(patch.assignedTo.map(String))];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw badRequest('assignedTo contains an invalid id');
    if (ids.length && (await Employee.countDocuments({ _id: { $in: ids } }).session(session || null)) !== ids.length) throw badRequest('Assignee not found');
    set('assignedTo', ids);
  }
  if (patch.startDate !== undefined) {
    if (patch.startDate !== null && !isDate(patch.startDate)) throw badRequest('startDate must be YYYY-MM-DD');
    set('startDate', patch.startDate);
  }

  // Due date set by hand is locked (D4): recalculation leaves it alone until it is unlocked
  if (patch.unlockDueDate) {
    if (task.dueOverridden) {
      changes.push({ field: 'dueOverridden', from: true, to: false });
      task.dueOverridden = false;
    }
  } else if (patch.dueDate !== undefined) {
    if (patch.dueDate !== null && !isDate(patch.dueDate)) throw badRequest('dueDate must be YYYY-MM-DD');
    set('dueDate', patch.dueDate);
    if (!task.dueOverridden) {
      changes.push({ field: 'dueOverridden', from: false, to: true });
      task.dueOverridden = true;
    }
    task.reminderSent = [];
  }

  if (patch.status !== undefined && patch.status !== task.status) {
    if (!TASK_STATUSES.includes(patch.status)) throw badRequest(`status must be one of ${TASK_STATUSES.join(', ')}`);
    const to = patch.status;
    if (to === 'NA') {
      const reason = String(patch.naReason || '').trim();
      if (!reason) throw badRequest('A reason is required to mark a task Not applicable');
      set('naReason', reason);
    } else if (task.status === 'NA') {
      set('naReason', '');
    }
    if (to === 'DONE') {
      const done = patch.completedDate !== undefined ? patch.completedDate : today; // one click = today (D6)
      if (!isDate(done)) throw badRequest('completedDate must be YYYY-MM-DD');
      if (done > today) throw badRequest('The completion date cannot be in the future');
      set('completedDate', done);
      if (!task.startDate) set('startDate', done <= today ? done : today);
    } else {
      if (task.completedDate) set('completedDate', null);
      if (['INITIATED', 'AWAITING'].includes(to) && !task.startDate) set('startDate', today);
    }
    set('status', to);
    if (to === 'DONE' || to === 'NA') {
      const stopped = stopOnClose(task);
      if (stopped) changes.push(stopped);
    }
  } else if (patch.completedDate !== undefined && task.status === 'DONE') {
    if (!isDate(patch.completedDate)) throw badRequest('completedDate must be YYYY-MM-DD');
    if (patch.completedDate > today) throw badRequest('The completion date cannot be in the future');
    set('completedDate', patch.completedDate);
  } else if (patch.naReason !== undefined && task.status === 'NA') {
    if (!String(patch.naReason).trim()) throw badRequest('A reason is required to mark a task Not applicable');
    set('naReason', String(patch.naReason).trim());
  }
  return changes;
}

// ---------------------------------------------------------------- linked fields (C5, D9)
// Where a task's linked field lives: { kind: 'voyage' | 'portCall', group, key, portCall, zone }
async function resolveLinkedTarget(task, voyage, { session } = {}) {
  const path = task.linkedField;
  if (!path) return null;
  const parts = path.split('.');
  if (parts[0] === 'portCall') {
    let pc = null;
    let group;
    let key;
    if (['LOADING', 'DISCHARGING', 'BUNKERING'].includes(parts[1])) {
      // portCall.<TYPE>.<group>.<key>: the current or next call of that type
      const calls = await PortCall.find({ voyage: voyage._id, type: parts[1], status: 'ACTIVE' }).sort({ seq: 1 }).session(session || null);
      pc = calls.find((c) => !(c.actual && c.actual.atd)) || calls[calls.length - 1] || null;
      [, , group, key] = parts;
    } else {
      pc = task.portCall ? await PortCall.findById(task.portCall).session(session || null) : null;
      [, group, key] = parts;
    }
    if (!pc) throw badRequest('This task has no port call to record the time on');
    return { kind: 'portCall', group, key, portCall: pc, zone: pc.timeZone, field: `${group}.${key}` };
  }
  const [group, key] = parts;
  const zone = group === 'delivery' ? voyage.delivery?.timeZone || OFFICE_TZ
    : group === 'redelivery' ? voyage.redelivery?.timeZone || OFFICE_TZ : OFFICE_TZ;
  return { kind: 'voyage', group, key, zone, field: `${group}.${key}` };
}

// Write a captured time to the voyage / port call. Returns a date revision entry (or null if unchanged)
// and whether an actual time changed (which ends a manual vessel-status override).
async function writeLinkedValue(task, voyage, value, { session } = {}) {
  const target = await resolveLinkedTarget(task, voyage, { session });
  if (!target) return null;
  const at = parseInstant(value, 'The captured time');
  if (!at) throw badRequest('Enter the date and time to record');
  if (target.kind === 'portCall') {
    const pc = target.portCall;
    const before = pc[target.group] && pc[target.group][target.key];
    if (before && new Date(before).getTime() === at.getTime()) return { revision: null, actualChanged: false };
    pc[target.group][target.key] = at;
    if (target.group === 'planned' && ['etb', 'etc', 'ets'].includes(target.key)) pc.manual[target.key] = true;
    applySuggestions(pc);
    assertPortCallOrder(pc, pc.port ? 'Port call' : 'Port call');
    await pc.save({ session });
    return {
      revision: { portCall: pc._id, field: target.field, from: before || null, to: at },
      actualChanged: target.group === 'actual',
      changed: { field: `portCall.${target.field}`, portCall: pc._id, portType: pc.type },
    };
  }
  const v = await Voyage.findById(voyage._id).session(session || null);
  const before = v[target.group] && v[target.group][target.key];
  if (before && new Date(before).getTime() === at.getTime()) return { revision: null, actualChanged: false };
  v[target.group][target.key] = at;
  await v.save({ session });
  return {
    revision: { field: target.field, from: before || null, to: at },
    actualChanged: target.key === 'actual',
    changed: { field: target.field, portCall: null },
  };
}

module.exports = { applyTaskPatch, resolveLinkedTarget, writeLinkedValue, OPEN, badRequest };
