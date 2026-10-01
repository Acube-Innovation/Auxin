// The scheduled jobs of Vessel Operations (Development Scope 6.1). Each run(ctx) returns a small summary
// that is stored on the job (Ops Masters → Scheduled Jobs).
const { DateTime } = require('luxon');
const Voyage = require('../../models/ops/Voyage');
const VoyageTask = require('../../models/ops/VoyageTask');
const User = require('../../models/User');
const engine = require('../../services/ops/dueDateEngine');
const dailyChecks = require('../../services/ops/dailyChecks');
const { generateRecurring } = require('../../services/ops/recurring');
const notifier = require('../../services/ops/notifier');
const templates = require('../../services/ops/emailTemplates');
const cfg = require('../../services/ops/config');
const { VESSEL_STATUSES } = require('../../services/ops/constants');

const OPEN = ['NOT_STARTED', 'INITIATED', 'AWAITING'];
const STATUS_LABEL = Object.fromEntries(VESSEL_STATUSES.map((s) => [s.value, s.label]));
const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const nowMinutes = () => { const n = DateTime.now().setZone(cfg.OFFICE_TZ); return n.hour * 60 + n.minute; };
const idOf = (v) => (v ? String(v._id || v) : null);
const voyageInfo = (v) => ({
  voyageId: idOf(v), voyageNo: v.voyageNo, vesselName: v.vessel ? v.vessel.name : '',
  vesselStatus: STATUS_LABEL[(v.vesselStatusOverride && v.vesselStatusOverride.value) || v.vesselStatus] || '',
});
const taskInfo = (t, extra = {}) => ({
  taskId: idOf(t), voyageId: idOf(t.voyage), name: t.name, code: t.code, dueDate: t.dueDate, priority: t.priority, ...extra,
});

async function activeVoyages() {
  return Voyage.find({ status: 'ACTIVE' }).populate('vessel', 'name').lean();
}

// Group [{ voyage, task }] per voyage, in voyage-number order
function byVoyage(rows, voyagesById) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.voyageId)) map.set(r.voyageId, { ...voyageInfo(voyagesById.get(r.voyageId)), tasks: [] });
    map.get(r.voyageId).tasks.push(r);
  }
  return [...map.values()].sort((a, b) => a.voyageNo.localeCompare(b.voyageNo));
}

// Which reminder is due for a task today (F2): HIGH D-1, D0, overdue daily; MEDIUM D0, overdue daily; LOW D0
function reminderKind(task, today, tomorrow) {
  const profile = task.reminderProfile || task.priority || 'MEDIUM';
  if (task.dueDate === tomorrow && profile === 'HIGH') return { kind: 'D-1', key: `${task.dueDate}:D-1` };
  if (task.dueDate === today) return { kind: 'D0', key: `${task.dueDate}:D0` };
  if (task.dueDate < today && profile !== 'LOW') return { kind: 'OD', key: `${task.dueDate}:OD:${today}` };
  return null;
}

// ---------------------------------------------------------------- ops-reminder-scan (F1, F2)
async function reminderScan({ job }) {
  if (nowMinutes() < minutesOf(cfg.REMINDER_TIME)) return { note: `Reminders start at ${cfg.REMINDER_TIME} office time`, sent: 0 };
  const today = engine.todayIn();
  const tomorrow = DateTime.fromISO(today).plus({ days: 1 }).toISODate();
  const voyages = await activeVoyages();
  const voyagesById = new Map(voyages.map((v) => [idOf(v), v]));
  const tasks = await VoyageTask.find({
    voyage: { $in: [...voyagesById.keys()] }, status: { $in: OPEN }, dueDate: { $ne: null, $lte: tomorrow }, 'assignedTo.0': { $exists: true },
  }).select('voyage name code dueDate priority reminderProfile assignedTo reminderSent').lean();

  const perEmployee = new Map();     // employeeId → [task rows]
  const keysByTask = new Map();      // taskId → key to record
  for (const t of tasks) {
    const r = reminderKind(t, today, tomorrow);
    if (!r || (t.reminderSent || []).includes(r.key)) continue;
    keysByTask.set(idOf(t), r.key);
    const row = taskInfo(t, { kind: r.kind, overdueDays: engine.derive(t, today).overdueDays });
    for (const e of t.assignedTo) {
      if (!perEmployee.has(idOf(e))) perEmployee.set(idOf(e), []);
      perEmployee.get(idOf(e)).push(row);
    }
  }
  if (!keysByTask.size) return { tasks: 0, people: 0, emails: 0 };

  const people = await notifier.employeesWithUsers([...perEmployee.keys()]);
  let emails = 0;
  let bells = 0;
  for (const [empId, rows] of perEmployee) {
    const p = people.get(empId);
    if (!p) continue;
    const order = { OD: 0, D0: 1, 'D-1': 2 };
    rows.sort((a, b) => order[a.kind] - order[b.kind] || String(a.dueDate).localeCompare(String(b.dueDate)));
    const counts = rows.reduce((c, r) => ({ ...c, [r.kind]: (c[r.kind] || 0) + 1 }), {});
    const grouped = byVoyage(rows, voyagesById);
    const { subject, html } = templates.reminderEmail(p.employee.employeeName, grouped, counts);
    await notifier.email({ to: p.employee.emailId, toName: p.employee.employeeName, subject, html, kind: 'REMINDER', job });
    emails++;
    const single = rows.length === 1 ? rows[0] : null;
    bells += await notifier.bell(p.users, {
      id: `ops-reminder:${today}:${Date.now()}:${empId}`,
      type: 'ops-reminder',
      title: single ? `${single.kind === 'OD' ? 'Overdue' : single.kind === 'D0' ? 'Due today' : 'Due tomorrow'}: ${single.name}` : `Vessel ops: ${rows.length} tasks need attention`,
      body: single ? `${grouped[0].voyageNo} · ${grouped[0].vesselName}` : [counts.OD && `${counts.OD} overdue`, counts.D0 && `${counts.D0} due today`, counts['D-1'] && `${counts['D-1']} due tomorrow`].filter(Boolean).join(', ') + ` · ${grouped.map((g) => g.voyageNo).join(', ')}`,
      url: single ? `/operations/voyages/${single.voyageId}?tab=tasks&task=${single.taskId}` : '/operations/my-tasks',
    });
  }
  await VoyageTask.bulkWrite([...keysByTask].map(([id, key]) => ({ updateOne: { filter: { _id: id }, update: { $addToSet: { reminderSent: key } } } })));
  return { tasks: keysByTask.size, people: perEmployee.size, emails, bells };
}

// ---------------------------------------------------------------- ops-daily-digest (F4)
async function dailyDigest({ job }) {
  const today = engine.todayIn();
  const voyages = await activeVoyages();
  const voyagesById = new Map(voyages.map((v) => [idOf(v), v]));
  const tasks = await VoyageTask.find({
    voyage: { $in: [...voyagesById.keys()] }, status: { $in: OPEN }, dueDate: { $ne: null, $lte: today }, 'assignedTo.0': { $exists: true },
  }).select('voyage name code dueDate priority assignedTo status').lean();

  // Who gets a summary: operators of active voyages, and anyone with an open task due today / overdue
  const per = new Map(); // employeeId → Map<voyageId, { overdue, today, operator }>
  const slot = (emp, vid) => {
    if (!per.has(emp)) per.set(emp, new Map());
    const m = per.get(emp);
    if (!m.has(vid)) m.set(vid, { overdue: [], today: [], operator: false });
    return m.get(vid);
  };
  for (const v of voyages) for (const op of v.operators || []) slot(idOf(op), idOf(v)).operator = true;
  for (const t of tasks) {
    const row = taskInfo(t, { overdueDays: engine.derive(t, today).overdueDays });
    for (const e of t.assignedTo) slot(idOf(e), row.voyageId)[t.dueDate === today ? 'today' : 'overdue'].push(row);
  }
  // Today's checks of every active voyage (creates today's list if the 00:05 job has not run)
  const checks = new Map();
  for (const v of voyages) {
    const log = await dailyChecks.ensureToday(v._id);
    if (log) checks.set(idOf(v), { open: log.items.filter((i) => !i.done).map((i) => i.name), done: log.items.filter((i) => i.done).length, total: log.items.length });
  }

  const people = await notifier.employeesWithUsers([...per.keys()]);
  let sent = 0;
  for (const [empId, vmap] of per) {
    const p = people.get(empId);
    if (!p) continue;
    const list = [...vmap.entries()].map(([vid, s]) => ({
      ...voyageInfo(voyagesById.get(vid)),
      overdue: s.overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      today: s.today,
      checks: s.operator ? checks.get(vid) || null : null,
    })).sort((a, b) => a.voyageNo.localeCompare(b.voyageNo));
    const totals = {
      overdue: list.reduce((n, v) => n + v.overdue.length, 0),
      today: list.reduce((n, v) => n + v.today.length, 0),
      checksOpen: list.reduce((n, v) => n + (v.checks ? v.checks.open.length : 0), 0),
    };
    if (!totals.overdue && !totals.today && !totals.checksOpen) continue;
    const { subject, html } = templates.digestEmail(p.employee.employeeName, today, list, totals);
    await notifier.email({ to: p.employee.emailId, toName: p.employee.employeeName, subject, html, kind: 'DIGEST', job });
    await notifier.bell(p.users, {
      id: `ops-digest:${today}:${Date.now()}`,
      type: 'ops-digest',
      title: `Morning summary · ${list.length} vessel${list.length === 1 ? '' : 's'}`,
      body: `${totals.overdue} overdue, ${totals.today} due today, ${totals.checksOpen} daily checks to do`,
      url: '/operations/my-tasks',
    });
    sent++;
  }
  return { people: sent, voyages: voyages.length };
}

// ---------------------------------------------------------------- ops-escalation (F5)
async function escalation({ job }) {
  const today = engine.todayIn();
  const voyages = await activeVoyages();
  const voyagesById = new Map(voyages.map((v) => [idOf(v), v]));
  const tasks = await VoyageTask.find({ voyage: { $in: [...voyagesById.keys()] }, status: { $in: OPEN }, dueDate: { $ne: null, $lt: today } })
    .select('voyage name code dueDate priority assignedTo reminderSent').populate('assignedTo', 'employeeName').lean();
  const rows = [];
  const keys = [];
  for (const t of tasks) {
    const days = engine.derive(t, today).overdueDays;
    const limit = t.priority === 'HIGH' ? cfg.ESCALATE_HIGH_DAYS : cfg.ESCALATE_OTHER_DAYS;
    const key = `${t.dueDate}:ESC`;
    if (days <= limit || (t.reminderSent || []).includes(key)) continue;
    rows.push(taskInfo(t, { overdueDays: days, assignees: (t.assignedTo || []).map((a) => a.employeeName).join(', ') }));
    keys.push([idOf(t), key]);
  }
  if (!rows.length) return { tasks: 0, recipients: 0 };

  let recipients = await User.find({ role: { $in: cfg.ESCALATION_ROLES } }).select('username emailId role employeeId').populate('employeeId', 'employeeName emailId').lean();
  let fallback = false;
  if (!recipients.length) { // nobody in the escalation roles: tell the admins
    recipients = await User.find({ role: 'admin' }).select('username emailId role employeeId').populate('employeeId', 'employeeName emailId').lean();
    fallback = true;
  }
  rows.sort((a, b) => b.overdueDays - a.overdueDays);
  const grouped = byVoyage(rows, voyagesById);
  const rule = `High priority more than ${cfg.ESCALATE_HIGH_DAYS} day(s), others more than ${cfg.ESCALATE_OTHER_DAYS} day(s)`;
  for (const u of recipients) {
    const name = (u.employeeId && u.employeeId.employeeName) || u.username;
    const { subject, html } = templates.escalationEmail(name, grouped, rows.length, rule);
    await notifier.email({ to: u.emailId || (u.employeeId && u.employeeId.emailId), toName: name, subject, html, kind: 'ESCALATION', job });
  }
  await notifier.bell(recipients, {
    id: `ops-escalation:${today}:${Date.now()}`,
    type: 'ops-escalation',
    title: `Escalation: ${rows.length} task${rows.length === 1 ? '' : 's'} overdue beyond the limit`,
    body: grouped.map((g) => `${g.voyageNo} (${g.tasks.length})`).join(', '),
    url: grouped.length === 1 ? `/operations/voyages/${grouped[0].voyageId}?tab=tasks` : '/operations/voyages',
  });
  await VoyageTask.bulkWrite(keys.map(([id, key]) => ({ updateOne: { filter: { _id: id }, update: { $addToSet: { reminderSent: key } } } })));
  return { tasks: rows.length, recipients: recipients.length, ...(fallback ? { note: 'No users in the escalation roles; sent to admins' } : {}) };
}

// ---------------------------------------------------------------- ops-daily-checks (E1) and ops-recurring (E2)
async function dailyChecksJob() {
  let created = 0;
  for (const v of await Voyage.find({ status: 'ACTIVE' })) if (await dailyChecks.ensureToday(v)) created++;
  return { voyages: created, date: engine.todayIn() };
}

async function recurringJob() {
  let created = 0;
  let closed = 0;
  for (const v of await Voyage.find({ status: 'ACTIVE' }).select('_id')) {
    const r = await generateRecurring(v._id);
    created += r.created;
    closed += r.closed;
  }
  return { created, closed };
}

const JOBS = [
  { name: 'ops-daily-checks', label: 'Start today\'s daily checklists', schedule: { at: '00:05' }, run: dailyChecksJob, feature: 'E1' },
  { name: 'ops-recurring', label: 'Create recurring tasks (hire payment)', schedule: { at: '00:10' }, run: recurringJob, feature: 'E2' },
  { name: 'ops-daily-digest', label: 'Morning summary email', schedule: { at: cfg.DIGEST_TIME }, run: dailyDigest, feature: 'F4' },
  { name: 'ops-escalation', label: 'Escalate long-overdue tasks', schedule: { at: cfg.ESCALATION_TIME }, run: escalation, feature: 'F5' },
  { name: 'ops-reminder-scan', label: 'Task reminders (bell + email)', schedule: { everyMinutes: 15 }, run: reminderScan, feature: 'F1, F2' },
];

module.exports = { JOBS, reminderKind };
