// Notifications for Vessel Operations (features F1, F2, F4, F5): bell entries (Phase 1 NotificationBell,
// through the user-<id> socket room and the Notification collection for people who are offline) and
// emails (shared mailer), every email recorded in OpsEmailLog.
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const Employee = require('../../models/Employee');
const OpsEmailLog = require('../../models/ops/OpsEmailLog');
const mailer = require('../../utils/mailer');

let io = null;
const setIo = (instance) => { io = instance; };

// Employees with their login users: Map<employeeId, { employee, users: [User] }>
async function employeesWithUsers(employeeIds) {
  const ids = [...new Set((employeeIds || []).map(String))];
  if (!ids.length) return new Map();
  const [emps, users] = await Promise.all([
    Employee.find({ _id: { $in: ids } }).select('employeeName emailId').lean(),
    User.find({ employeeId: { $in: ids } }).select('username emailId role employeeId').lean(),
  ]);
  const out = new Map();
  for (const e of emps) out.set(String(e._id), { employee: e, users: users.filter((u) => String(u.employeeId) === String(e._id)) });
  return out;
}

async function isOnline(userId) {
  if (!io) return false;
  try { return (await io.in(`user-${userId}`).fetchSockets()).length > 0; } catch (e) { return false; }
}

// One bell entry for each user. payload: { id, type, title, body, url }
async function bell(users, payload) {
  let n = 0;
  for (const u of users) {
    const id = `${payload.id}:${u._id}`;
    const full = { ...payload, id, url: payload.url, meta: { url: payload.url, kind: payload.type }, timestamp: new Date() };
    const online = await isOnline(u._id);
    if (online) io.to(`user-${u._id}`).emit('notification', full);
    await Notification.create({ title: payload.title, body: payload.body, payload: full, userId: u._id, deliveredTo: online ? [u._id] : [] });
    n++;
  }
  return n;
}

// Send (or record as skipped) one email
async function email({ to, toName, subject, html, kind, job }) {
  if (!to) return { status: 'SKIPPED', reason: 'no address' };
  let status = 'SENT';
  let error;
  try {
    const r = await mailer.sendMail({ to, subject, html, fromName: 'Auxin Vessel Operations' });
    if (r && r.skipped) status = 'SKIPPED';
  } catch (err) {
    status = 'FAILED';
    error = err.message;
    console.error(`Ops email to ${to} failed:`, err.message);
  }
  await OpsEmailLog.create({ kind, to, toName, subject, html, status, error, job });
  return { status };
}

module.exports = { setIo, employeesWithUsers, bell, email };
