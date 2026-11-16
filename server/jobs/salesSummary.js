// Daily Sales & Leads summary: one email + bell each morning with the previous office day's changes (clients /
// leads added, edited, deleted, stage changes; events and remarks; meetings and tasks). Each recipient gets
// the changes of their own people:
//   - admins: everyone's changes
//   - a HOD (User Management → Leave Approvers): the people whose leave they approve
//   - SALES_SUMMARY_TO (default Jijesh): also the SALES_SUMMARY_USERS sales persons
// Meetings created or moved by someone are also told straight away to that person's HOD (and to
// SALES_SUMMARY_TO for the sales persons) — notifyMeeting below.
// Runs on the shared job scheduler (jobs/ops/scheduler.js).
//
// server/.env (defaults are the people agreed with the client, Nov 2026):
//   SALES_SUMMARY_USERS   sales persons reported to SALES_SUMMARY_TO — email or username, comma separated
//   SALES_SUMMARY_TO      who receives their summary — email or username, comma separated
//   SALES_SUMMARY_TIME    office time it is sent (default 08:00); it covers the whole previous day
//   SALES_SUMMARY_DISABLED=1  turns it off
const { DateTime } = require('luxon');
const User = require('../models/User');
const SalesActivity = require('../models/SalesActivity');
const LeaveApprover = require('../models/LeaveApprover');
const OpsEmailLog = require('../models/ops/OpsEmailLog');
const { leaveIdsOfEmployees, approversOfLeave } = require('../utils/leaveScope');
const notifier = require('../services/ops/notifier');
const { OFFICE_TZ, APP_URL } = require('../services/ops/config');

const list = (name, fallback) => (process.env[name] || fallback).split(',').map((s) => s.trim()).filter(Boolean);
const cfg = {
  users: list('SALES_SUMMARY_USERS', 'prafull@auxinshipping.com,shafeeq.koya@auxinshipping.com,beena@auxinshipping.com'),
  to: list('SALES_SUMMARY_TO', 'jnanu@auxinshipping.com'),
  time: process.env.SALES_SUMMARY_TIME || '08:00',
  enabled: process.env.SALES_SUMMARY_DISABLED !== '1',
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rx = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

// Users matching a list of emails / usernames (case-insensitive). Returns { found, missing }.
async function findUsers(keys) {
  const users = await User.find({ $or: keys.flatMap((k) => [{ emailId: rx(k) }, { username: rx(k) }]) })
    .select('username emailId employeeId').populate('employeeId', 'employeeName emailId').lean();
  const missing = keys.filter((k) => !users.some((u) => [u.emailId, u.username].some((v) => v && v.toLowerCase() === k.toLowerCase())));
  return { found: users, missing };
}

// The login name (an employee record can be shared by two logins, e.g. admin and the accounts manager)
const nameOf = (u) => u.username || (u.employeeId && u.employeeId.employeeName) || '';

const SECTIONS = [
  { key: 'client', title: 'Clients / leads' },
  { key: 'event', title: 'Events' },
  { key: 'remark', title: 'Remarks' },
  { key: 'meeting', title: 'Meetings' },
  { key: 'task', title: 'Tasks' },
];
const ACTION = { added: ['Added', '#067647'], edited: ['Edited', '#1570ef'], deleted: ['Deleted', '#b42318'] };
const MAX_ROWS = 40; // per person and section; the rest is counted

const th = (t, w = '') => `<th style="${w ? `width:${w};` : ''}text-align:left;padding:6px 8px;background:#f2f4f7;font-size:12px;color:#475467;border-bottom:1px solid #eaecf0">${t}</th>`;
const td = (t, extra = '') => `<td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #eaecf0;vertical-align:top;${extra}">${t}</td>`;

function detail(a) {
  const parts = [];
  if (a.stageChange) parts.push(`<b>Stage:</b> ${esc(a.stageChange.from || '(none)')} → ${esc(a.stageChange.to || '(none)')}`);
  for (const c of a.changes || []) {
    if (!c.from && !c.to) parts.push(esc(c.field));
    else if (!c.from && a.action === 'added') parts.push(`${esc(c.field)}: ${esc(c.to)}`);
    else parts.push(`${esc(c.field)}: ${esc(c.from || '(empty)')} → ${esc(c.to || '(empty)')}`);
  }
  return parts.join('<br>');
}

function rowHtml(a, tz) {
  const [label, color] = ACTION[a.action];
  const what = a.entity === 'client'
    ? `${esc(a.clientName)}${a.leadType ? ` <span style="color:#667085">(${esc(a.leadType)})</span>` : ''}`
    : `${a.entity === 'remark' ? `“${esc(a.title)}”` : esc(a.title)}${a.clientName ? `<br><span style="color:#667085">${esc(a.clientName)}</span>` : ''}`;
  return `<tr>${td(DateTime.fromJSDate(a.at).setZone(tz).toFormat('HH:mm'), 'white-space:nowrap;color:#667085')}${td(`<span style="color:${color};font-weight:bold">${label}</span>`)}${td(what)}${td(detail(a))}</tr>`;
}

function personHtml(person, acts, tz) {
  if (!acts.length) return `<h3 style="margin:20px 0 4px;font-size:15px;color:#0b3a6f">${esc(person)}</h3><p style="margin:0;color:#667085;font-size:13px">No updates.</p>`;
  const counts = SECTIONS.map((s) => [s.title, acts.filter((a) => a.entity === s.key).length]).filter(([, n]) => n).map(([t, n]) => `${t}: ${n}`).join(' · ');
  let html = `<h3 style="margin:20px 0 2px;font-size:15px;color:#0b3a6f">${esc(person)}</h3><p style="margin:0 0 6px;color:#475467;font-size:13px">${counts}</p>`;
  for (const s of SECTIONS) {
    const rows = acts.filter((a) => a.entity === s.key);
    if (!rows.length) continue;
    html += `<div style="margin:10px 0 4px;font-weight:bold;font-size:13px">${s.title}</div>
<table style="border-collapse:collapse;width:100%"><tr>${th('Time', '48px')}${th('', '62px')}${th(s.key === 'client' ? 'Client / lead' : 'Item', '40%')}${th('Details')}</tr>
${rows.slice(0, MAX_ROWS).map((a) => rowHtml(a, tz)).join('\n')}</table>`;
    if (rows.length > MAX_ROWS) html += `<p style="margin:4px 0 0;font-size:12px;color:#667085">…and ${rows.length - MAX_ROWS} more.</p>`;
  }
  return html;
}

function summaryEmail(dayLabel, people, total, tz, scopeText = 'the sales team') {
  const body = people.length ? people.map((p) => personHtml(p.name, p.acts, tz)).join('\n') : '<p style="margin:14px 0 0;color:#667085">No updates.</p>';
  return {
    subject: `Sales & Leads daily summary – ${dayLabel}${total ? ` (${total} update${total === 1 ? '' : 's'})` : ' (no updates)'}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#101828;max-width:860px">
  <div style="background:#0b3a6f;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-size:17px;font-weight:bold">Auxin · Sales &amp; Leads</div>
  <div style="border:1px solid #d0d5dd;border-top:none;padding:18px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 6px;font-size:18px;color:#0b3a6f">Daily summary – ${esc(dayLabel)}</h2>
    <p style="margin:0 0 6px;color:#475467">Changes made by ${esc(scopeText)} in Auxin CRM on ${esc(dayLabel)}: clients and leads, events, remarks, meetings and tasks.</p>
    ${body}
    <p style="margin:18px 0 0"><a href="${esc(`${APP_URL}/`)}" style="background:#1570ef;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;display:inline-block">Open Auxin CRM</a></p>
    <p style="margin:18px 0 0;font-size:12px;color:#98a2b3">Times are office time (${esc(tz)}). This email is sent automatically by Auxin every morning.</p>
  </div></div>`,
  };
}

// HOD login id → [user ids of the people whose leave they approve]
async function hodTeams() {
  const rows = await LeaveApprover.find({ hod: { $ne: null } }).lean();
  const byHod = new Map();
  for (const r of rows) {
    const k = String(r.hod);
    if (!byHod.has(k)) byHod.set(k, []);
    byHod.get(k).push(r);
  }
  const out = new Map();
  for (const [hod, list] of byHod) {
    const ids = new Set(list.filter((r) => r.user).map((r) => String(r.user)));
    (await leaveIdsOfEmployees(list.filter((r) => r.employee).map((r) => r.employee))).forEach((x) => ids.add(String(x)));
    const users = await User.find({ _id: { $in: [...ids] } }).select('_id').lean(); // keep logins only
    out.set(hod, users.map((u) => String(u._id)).filter((u) => u !== hod));
  }
  return out;
}

// Who gets a summary and whose changes it shows: Map<userId, { user, all, actors: Set<userId>, scopeText }>
async function audiences() {
  const out = new Map();
  const slot = (u) => {
    const k = String(u._id);
    if (!out.has(k)) out.set(k, { user: u, all: false, actors: new Set(), scopes: new Set() });
    return out.get(k);
  };
  const sel = 'username emailId role employeeId';
  for (const a of await User.find({ role: 'admin' }).select(sel).lean()) { const s = slot(a); s.all = true; s.scopes.add('all staff'); }
  const teams = await hodTeams();
  const hodUsers = await User.find({ _id: { $in: [...teams.keys()] } }).select(sel).lean();
  for (const h of hodUsers) {
    const s = slot(h);
    teams.get(String(h._id)).forEach((x) => s.actors.add(x));
    s.scopes.add('the people you approve');
  }
  const tracked = await findUsers(cfg.users);
  const to = await findUsers(cfg.to);
  for (const r of to.found) {
    const s = slot(r);
    tracked.found.forEach((u) => s.actors.add(String(u._id)));
    s.scopes.add('the sales team');
    s.daily = true; // sent even on a day without updates
  }
  for (const s of out.values()) s.actors.delete(String(s.user._id));
  const notes = [];
  if (tracked.missing.length) notes.push(`No login found for: ${tracked.missing.join(', ')}`);
  if (to.missing.length) notes.push(`No login found for recipient: ${to.missing.join(', ')}`);
  return { audiences: out, notes };
}

// Store (and email if the login has an address) one summary for one login; returns the log id
async function deliver(user, subject, html, job, kind) {
  const to = user.emailId || '';
  if (to) return (await notifier.email({ to, toName: nameOf(user), toUser: user._id, subject, html, kind, job, fromName: 'Auxin CRM' })).id;
  const log = await OpsEmailLog.create({ kind, to: '(no email address)', toName: nameOf(user), toUser: user._id, subject, html, status: 'SKIPPED', error: 'Login has no email address', job });
  return log._id;
}

// The job. The scheduled run covers the previous office day; "Run now" (trigger 'manual') covers today up to
// now, so an admin can preview it; ctx.day ('YYYY-MM-DD') picks another whole day (tests / scripts).
async function salesSummary({ job, trigger, day } = {}) {
  const tz = OFFICE_TZ;
  const now = DateTime.now().setZone(tz);
  const soFar = !day && trigger === 'manual';
  const start = day ? DateTime.fromISO(day, { zone: tz }).startOf('day') : soFar ? now.startOf('day') : now.minus({ days: 1 }).startOf('day');
  const end = soFar ? now : start.plus({ days: 1 });
  const dayLabel = `${start.toFormat('ccc dd-LLL-yyyy')}${soFar ? ` (until ${now.toFormat('HH:mm')})` : ''}`;

  const { audiences: aud, notes } = await audiences();
  const acts = await SalesActivity.find({ at: { $gte: start.toJSDate(), $lt: end.toJSDate() } }).sort({ at: 1 }).lean();
  const names = new Map((await User.find().select('username employeeId').lean()).map((u) => [String(u._id), nameOf(u)]));

  let sent = 0;
  let bells = 0;
  let recipients = 0;
  for (const a of aud.values()) {
    if (!a.all && !a.actors.size) continue;
    const mine = a.all ? acts : acts.filter((x) => a.actors.has(String(x.actor)));
    if (!mine.length && !a.daily) continue; // admins / HODs: nothing to report, nothing sent
    // Everyone of a team is listed (with "No updates"); for "all staff" only the people who changed something
    const ids = a.all ? [...new Set(mine.map((x) => String(x.actor)))] : [...a.actors];
    const people = ids.map((id) => ({ name: names.get(id) || mine.find((x) => String(x.actor) === id)?.actorName || 'Unknown', acts: mine.filter((x) => String(x.actor) === id) }))
      .sort((p, q) => p.name.localeCompare(q.name));
    const scopeText = a.all ? 'all staff' : [...a.scopes].join(' and ');
    const { subject, html } = summaryEmail(dayLabel, people, mine.length, tz, scopeText);
    const id = await deliver(a.user, subject, html, job, 'SALES_SUMMARY');
    const log = await OpsEmailLog.findById(id).select('status').lean();
    if (log && log.status === 'SENT') sent++;
    recipients++;
    const perPerson = people.filter((p) => p.acts.length).map((p) => `${p.name} ${p.acts.length}`).join(', ');
    bells += await notifier.bell([a.user], {
      id: `sales-summary:${start.toISODate()}:${Date.now()}`,
      type: 'sales-summary',
      title: `Sales daily summary – ${dayLabel}`,
      body: mine.length ? `${mine.length} update${mine.length === 1 ? '' : 's'}: ${perPerson}` : 'No updates',
      url: `/sales-summary?id=${id}`,
    });
  }
  return { day: start.toISODate(), updates: acts.length, recipients, sent, bells, ...(notes.length ? { note: notes.join('; ') } : {}) };
}

// Straight away (not in the morning): a meeting created, or its date / time changed, is told to the
// person's HOD (Leave Approvers), and for the sales persons also to SALES_SUMMARY_TO. Bell + email. Never throws.
const whenText = (m) => `${m.date ? DateTime.fromISO(new Date(m.date).toISOString().slice(0, 10)).toFormat('ccc dd-LLL-yyyy') : ''}${m.time ? ` ${m.time}` : ''}`;

async function meetingRecipients(actor) {
  const out = new Map();
  const { hod } = await approversOfLeave(actor._id);
  if (hod) out.set(String(hod._id), hod);
  const { found: tracked } = await findUsers(cfg.users);
  if (tracked.some((u) => String(u._id) === String(actor._id))) (await findUsers(cfg.to)).found.forEach((u) => out.set(String(u._id), u));
  out.delete(String(actor._id));
  return [...out.values()];
}

async function notifyMeeting(actor, meeting, before) {
  try {
    if (!cfg.enabled || !actor) return;
    const recipients = await meetingRecipients(actor);
    if (!recipients.length) return;
    const who = actor.username || 'Someone';
    const now = whenText(meeting);
    const was = before ? whenText(before) : '';
    const title = before ? `${who} moved a meeting: ${meeting.title}` : `${who} created a meeting: ${meeting.title}`;
    const body = before ? `${was} → ${now}` : now;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#101828;max-width:620px">
  <div style="background:#0b3a6f;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-size:17px;font-weight:bold">Auxin · Sales &amp; Leads</div>
  <div style="border:1px solid #d0d5dd;border-top:none;padding:18px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 10px;font-size:18px;color:#0b3a6f">${esc(before ? 'Meeting time changed' : 'New meeting')}</h2>
    <p style="margin:0 0 6px"><b>${esc(meeting.title)}</b></p>
    <p style="margin:0 0 6px">${before ? `When: <s style="color:#667085">${esc(was)}</s> → <b>${esc(now)}</b>` : `When: <b>${esc(now)}</b>`}</p>
    <p style="margin:0 0 6px;color:#475467">${before ? 'Changed' : 'Created'} by ${esc(who)}</p>
    ${meeting.notes ? `<p style="margin:0 0 6px;color:#475467">Notes: ${esc(meeting.notes)}</p>` : ''}
    <p style="margin:18px 0 0"><a href="${esc(`${APP_URL}/yourcalendar`)}" style="background:#1570ef;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;display:inline-block">Open calendar</a></p>
  </div></div>`;
    for (const r of recipients) {
      if (r.emailId) await notifier.email({ to: r.emailId, toName: nameOf(r), toUser: r._id, subject: title, html, kind: 'SALES_MEETING', job: 'sales-meeting', fromName: 'Auxin CRM' });
      await notifier.bell([r], { id: `sales-meeting:${meeting._id}:${Date.now()}`, type: 'sales-meeting', title, body, url: '/yourcalendar' });
    }
  } catch (err) {
    console.error('[sales-meeting] notify failed:', err.message);
  }
}

// Can this login open the Sales Summary page (admin, a HOD, or a SALES_SUMMARY_TO recipient)?
async function canView(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (await LeaveApprover.exists({ hod: user._id })) return true;
  return (await findUsers(cfg.to)).found.some((u) => String(u._id) === String(user._id));
}

const JOB = {
  name: 'sales-daily-summary',
  label: 'Sales & Leads daily summary to HOD',
  schedule: { at: cfg.time },
  run: salesSummary,
  feature: 'Sales',
  enabled: () => cfg.enabled,
};

module.exports = { JOB, salesSummary, summaryEmail, notifyMeeting, canView, audiences, cfg };
