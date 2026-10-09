// Working time on a voyage task: Start / Hold / Stop (actual hours vs the template's planned hours).
// Only running periods count. Example: start 09:00, hold 10:00, start again 11:00, stop 12:00 = 2 hours.
const TaskTemplate = require('../../models/ops/TaskTemplate');

const ACTIONS = ['start', 'hold', 'stop'];
const ACTION_NOTE = { start: 'Timer started', hold: 'Timer on hold', stop: 'Timer stopped' };

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const hoursText = (seconds) => {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

// Close the running period (if any). Returns the seconds it added.
function closeRunning(task, now) {
  if (!task.timer || task.timer.state !== 'RUNNING' || !task.timer.runningSince) return 0;
  const start = new Date(task.timer.runningSince);
  const seconds = Math.max(0, Math.round((now.getTime() - start.getTime()) / 1000));
  const open = (task.timeLog || []).find((p) => !p.end && p.start && new Date(p.start).getTime() === start.getTime());
  if (open) open.end = now;
  else task.timeLog.push({ start, end: now, by: null });
  task.workedSeconds = (task.workedSeconds || 0) + seconds;
  task.timer.runningSince = null;
  return seconds;
}

// Apply start / hold / stop to a task document (not saved). Returns the history entry.
function applyTimerAction(task, action, user, now = new Date()) {
  if (!ACTIONS.includes(action)) throw badRequest(`action must be one of ${ACTIONS.join(', ')}`);
  if (['DONE', 'NA'].includes(task.status)) throw badRequest('Re-open the task before recording time on it');
  if (!task.timer) task.timer = { state: null, runningSince: null };
  const from = task.timer.state || null;

  if (action === 'start') {
    if (from === 'RUNNING') throw badRequest('The timer is already running');
    task.timer.state = 'RUNNING';
    task.timer.runningSince = now;
    task.timeLog.push({ start: now, end: null, by: user ? user._id : null });
  } else if (action === 'hold') {
    if (from !== 'RUNNING') throw badRequest('Only a running timer can be put on hold');
    closeRunning(task, now);
    task.timer.state = 'HELD';
  } else {
    if (from !== 'RUNNING' && from !== 'HELD') throw badRequest('Start the timer first');
    closeRunning(task, now);
    task.timer.state = 'STOPPED';
  }
  return { field: 'timer', from, to: task.timer.state, note: `${ACTION_NOTE[action]} · worked ${hoursText(task.workedSeconds || 0)}` };
}

// A task that is closed (Done / N/A) stops its timer. Returns the history entry, or null if nothing changed.
function stopOnClose(task, now = new Date()) {
  const from = task.timer && task.timer.state;
  if (from !== 'RUNNING' && from !== 'HELD') return null;
  closeRunning(task, now);
  task.timer.state = 'STOPPED';
  return { field: 'timer', from, to: 'STOPPED', note: `Timer stopped when the task was closed · worked ${hoursText(task.workedSeconds || 0)}`, auto: true };
}

// Worked seconds including the period running now
function actualSeconds(task, now = new Date()) {
  let s = task.workedSeconds || 0;
  if (task.timer && task.timer.state === 'RUNNING' && task.timer.runningSince) s += Math.max(0, (now.getTime() - new Date(task.timer.runningSince).getTime()) / 1000);
  return Math.round(s);
}

// Tasks created before planned hours existed take them from their template (lean task objects, changed in place)
async function fillPlannedHours(tasks) {
  const ids = [...new Set(tasks.filter((t) => t.plannedHours == null && t.template).map((t) => String(t.template._id || t.template)))];
  if (!ids.length) return tasks;
  const templates = await TaskTemplate.find({ _id: { $in: ids }, plannedHours: { $ne: null } }).select('plannedHours').lean();
  const byId = new Map(templates.map((t) => [String(t._id), t.plannedHours]));
  for (const t of tasks) {
    if (t.plannedHours == null && t.template) t.plannedHours = byId.get(String(t.template._id || t.template)) ?? null;
  }
  return tasks;
}

module.exports = { ACTIONS, applyTimerAction, stopOnClose, actualSeconds, fillPlannedHours, hoursText };
