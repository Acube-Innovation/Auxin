// Acceptance scenarios of the Development Scope §13, run end-to-end through the real API.
// Starts a second server on port 5055 against a separate database "auxin_test" (never the app's data).
// Run: npm run test:ops   (from server/; needs the local MongoDB replica set running)
require('dotenv').config({ quiet: true });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { localToUtc } = require('../../services/ops/time');

const PORT = 5055;
const API = `http://127.0.0.1:${PORT}/api`;
const TEST_URI = process.env.MONGO_URI.replace(/\/auxin_db(\?|$)/, '/auxin_test$1');
const SERVER_DIR = path.join(__dirname, '..', '..');
// Scheduler off (jobs are started through "Run now"), reminders allowed at any time of day
const ENV = { ...process.env, MONGO_URI: TEST_URI, PORT: String(PORT), EMAIL_USER: '', EMAIL_PASS: '', OPS_JOBS_DISABLED: '1', OPS_REMINDER_TIME: '00:00' };
assert.notEqual(TEST_URI, process.env.MONGO_URI, 'test must not use the app database');

let server;
const tokens = {};
const ctx = {};
const MUSCAT = 'Asia/Muscat';
const iso = (local, zone) => localToUtc(local, zone).toISOString();

async function call(method, url, body, who = 'admin') {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[who]}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const taskByCode = (tasks, code, portSeq) => tasks.find((t) => t.code === code && (portSeq === undefined || (t.portCall && t.portCall.seq === portSeq)));

before(async () => {
  // Fresh test database with masters, two operators and the sample voyage
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  const run = (script) => {
    const r = spawnSync('node', [script], { cwd: SERVER_DIR, env: ENV, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${script} failed: ${r.stderr || r.stdout}`);
  };
  run('scripts/seedOps.js');
  const Employee = require('../../models/Employee');
  const User = require('../../models/User');
  const Client = require('../../models/Client');
  const e1 = await Employee.create({ employeeId: 'T1', employeeName: 'Test Op One', mobile: '1', emailId: 'ops1@auxin.local', role: 'Operations Executive', department: 'Bulk Operations' });
  const e2 = await Employee.create({ employeeId: 'T2', employeeName: 'Test Op Two', mobile: '2', emailId: 'ops2@auxin.local', role: 'Operations Executive', department: 'Bulk Operations' });
  const hash = bcrypt.hashSync('pw', 4);
  const admin = await User.create({ username: 'admin', password: hash, role: 'admin' });
  await User.create({ username: 'ops1', password: hash, role: 'operations_executive', employeeId: e1._id });
  await User.create({ username: 'ops2', password: hash, role: 'operations_executive', employeeId: e2._id });
  await Client.create({ companyName: 'Charterer Co', clientType: 'Charterer', createdBy: admin._id, assignedTo: admin._id });
  await Client.create({ companyName: 'Agent Co', clientType: 'Agent', createdBy: admin._id, assignedTo: admin._id });
  ctx.e2 = String(e2._id);
  run('scripts/seedSampleVoyage.js');

  server = spawn('node', ['server.js'], { cwd: SERVER_DIR, env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('test server did not start')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes('MongoDB connected')) { clearTimeout(t); resolve(); } });
  });
  for (const u of ['admin', 'ops1', 'ops2']) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'pw' }) });
    tokens[u] = (await r.json()).token;
  }
  const list = await call('GET', '/ops/voyages?status=ALL');
  ctx.voyage = list.data.items[0];
});

after(async () => {
  if (server) server.kill();
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
});

test('sample voyage: suggestions filled ETB / ETC (Salalah 16:18 / 09-Jul 16:18 LT; Kakinada ETC = ETB + 3.12 days)', async () => {
  const { data } = await call('GET', `/ops/voyages/${ctx.voyage._id}`);
  const [salalah, kochi, kakinada] = data.portCalls;
  ctx.calls = { salalah, kochi, kakinada };
  assert.equal(salalah.planned.etb, iso('2026-07-05T16:18', MUSCAT));
  assert.equal(salalah.planned.etc, iso('2026-07-09T16:18', MUSCAT));
  assert.equal(salalah.manual.etb, false);
  const days = (new Date(kakinada.planned.etc) - new Date(kakinada.planned.etb)) / 86400000;
  assert.equal(Math.round(days * 100) / 100, 3.12);
  assert.ok(kochi.planned.etb, 'bunkering call has a suggested ETB');
});

test('generation preview: 127 tasks, optional "if required" tasks unticked', async () => {
  const { status, data } = await call('POST', `/ops/voyages/${ctx.voyage._id}/generate-preview`);
  assert.equal(status, 200);
  assert.equal(data.totals.total, 127);
  assert.equal(data.totals.optional, 4);
  assert.equal(data.totals.included, 123);
  const agm = data.tasks.find((t) => t.code === 'T049');
  assert.equal(agm.included, false);
  assert.equal(agm.portCall.port, 'Salalah');
  ctx.preview = data.tasks;
});

test('activation: tasks created, China AGM inspection kept as Not applicable with reason, original plan frozen', async () => {
  const excluded = [{ code: 'T049', portCall: ctx.calls.salalah._id, reason: 'Not required for this cargo' }];
  const { status, data } = await call('POST', `/ops/voyages/${ctx.voyage._id}/activate`, { excluded, adhocTasks: [{ name: 'Check port congestion report', dueDate: '2026-07-01', priority: 'HIGH' }] });
  assert.equal(status, 200, JSON.stringify(data));
  assert.equal(data.status, 'ACTIVE');
  assert.equal(data.activation.created, 128); // 127 + 1 ad-hoc
  assert.equal(data.activation.notApplicable, 1);
  assert.equal(data.portCalls[0].original.eta, data.portCalls[0].planned.eta);
  assert.equal(data.delivery.original, data.delivery.estimated);
  const again = await call('POST', `/ops/voyages/${ctx.voyage._id}/activate`, {});
  assert.equal(again.status, 400);
});

test('due dates match the scope §13 examples', async () => {
  const { data } = await call('GET', `/ops/voyages/${ctx.voyage._id}/tasks`);
  const t = data.tasks;
  ctx.tasks = t;
  assert.equal(t.length, 128);
  assert.equal(taskByCode(t, 'T001').dueDate, '2026-06-26'); // Read Cargo Recap
  assert.equal(taskByCode(t, 'T009').dueDate, '2026-06-26'); // Initial Voyage Estimation
  assert.equal(taskByCode(t, 'T014').dueDate, '2026-06-28'); // Read Vessel Recap
  assert.equal(taskByCode(t, 'T031').dueDate, '2026-07-03'); // Check Waypoints / Send to Weather Routing
  assert.equal(taskByCode(t, 'T043').dueDate, '2026-06-30'); // Appoint Loadport Agent
  assert.equal(taskByCode(t, 'T054').dueDate, '2026-07-11'); // Appoint Bunker Port Agent (not 12-Jul as ROUND gives)
  assert.equal(taskByCode(t, 'T100').dueDate, '2026-07-11'); // Appoint Discharge Port Agents
  assert.equal(taskByCode(t, 'T093').dueDate, '2026-07-12'); // Re-delivery notice 15 days
  assert.equal(taskByCode(t, 'T127').dueDate, '2026-07-20'); // Next Hire Payment (delivery + 15)
  assert.equal(taskByCode(t, 'T043').name, 'Salalah – Appoint Loadport Agent');
  assert.equal(taskByCode(t, 'T041').bucket, 'AWAITING_DATE'); // bunker not booked yet
  const agm = taskByCode(t, 'T049');
  assert.equal(agm.status, 'NA');
  assert.equal(agm.naReason, 'Not required for this cargo');
  const adhoc = t.find((x) => x.name === 'Check port congestion report');
  assert.equal(adhoc.dueDate, '2026-07-01');
  assert.equal(adhoc.code, null);
});

test('ETA change: open tasks move, Done and hand-dated tasks stay, revision logged', async () => {
  const VoyageTask = require('../../models/ops/VoyageTask');
  const t044 = taskByCode(ctx.tasks, 'T044');
  const t053 = taskByCode(ctx.tasks, 'T053');
  await VoyageTask.updateOne({ _id: t044._id }, { $set: { status: 'DONE', completedDate: '2026-06-29' } });
  await VoyageTask.updateOne({ _id: t053._id }, { $set: { dueDate: '2026-06-25', dueOverridden: true } });

  const { status, data } = await call('PUT', `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.salalah._id}`,
    { planned: { eta: iso('2026-07-07T11:30', MUSCAT) }, reason: 'Delay at previous port' });
  assert.equal(status, 200, JSON.stringify(data));
  const moved = new Map(data.movedTasks.map((m) => [m.code, m]));
  assert.deepEqual({ from: moved.get('T043').from, to: moved.get('T043').to }, { from: '2026-06-30', to: '2026-07-02' });
  assert.ok(!moved.has('T044'), 'done task must not move');
  assert.ok(!moved.has('T053'), 'hand-dated task must not move');
  assert.ok(data.dueSoon.length >= 1);
  assert.equal(data.portCall.planned.etb, iso('2026-07-07T16:18', MUSCAT)); // suggestion followed the ETA

  const tasks = (await call('GET', `/ops/voyages/${ctx.voyage._id}/tasks`)).data.tasks;
  assert.equal(taskByCode(tasks, 'T044').dueDate, '2026-06-30');
  assert.equal(taskByCode(tasks, 'T053').dueDate, '2026-06-25');

  const revisions = (await call('GET', `/ops/voyages/${ctx.voyage._id}/revisions`)).data;
  const eta = revisions.find((r) => r.field === 'planned.eta');
  assert.equal(eta.reason, 'Delay at previous port');
  assert.equal(eta.tasksMoved, data.movedTasks.length);
  assert.equal(eta.portCall.port.name, 'Salalah');

  const same = await call('PUT', `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.salalah._id}`, { planned: { eta: iso('2026-07-07T11:30', MUSCAT) } });
  assert.equal(same.data.movedTasks.length, 0, 'saving the same ETA again moves nothing');
});

test('actuals drive the vessel status and the after-sailing due dates', async () => {
  const url = `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.salalah._id}`;
  const status = async () => (await call('GET', `/ops/voyages/${ctx.voyage._id}`)).data.vesselStatusShown;
  assert.equal(await status(), 'AWAITING_DELIVERY');
  await call('PUT', url, { actual: { ata: iso('2026-07-07T10:00', MUSCAT) } });
  assert.equal(await status(), 'WAITING_FOR_BERTH');
  await call('PUT', url, { actual: { atb: iso('2026-07-07T20:00', MUSCAT) } });
  assert.equal(await status(), 'AT_LOAD_PORT');
  const r = await call('PUT', url, { actual: { atd: iso('2026-07-11T18:00', MUSCAT) } });
  assert.equal(r.status, 200);
  assert.equal(await status(), 'ENROUTE_BUNKERING_PORT');
  const tasks = (await call('GET', `/ops/voyages/${ctx.voyage._id}/tasks`)).data.tasks;
  assert.equal(taskByCode(tasks, 'T075').dueDate, '2026-07-12'); // ATD date + 1
  const bad = await call('PUT', url, { actual: { atd: iso('2026-07-06T18:00', MUSCAT) } });
  assert.equal(bad.status, 400, 'ATD before ATA is refused');
});

test('manual vessel status override until the next actual is entered', async () => {
  const set = await call('PUT', `/ops/voyages/${ctx.voyage._id}/vessel-status`, { value: 'WAITING_FOR_BERTH' });
  assert.equal(set.data.vesselStatusShown, 'WAITING_FOR_BERTH');
  await call('PUT', `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.kochi._id}`, { actual: { ata: iso('2026-07-13T12:00', 'Asia/Kolkata') } });
  const after = (await call('GET', `/ops/voyages/${ctx.voyage._id}`)).data;
  assert.equal(after.vesselStatusOverride.value, null);
  assert.equal(after.vesselStatusShown, 'AT_BUNKERING_PORT');
});

test('port call added on an active voyage generates its tasks; cancelling it marks them Not applicable', async () => {
  const ports = (await call('GET', '/ops/ports')).data;
  const djibouti = ports.find((p) => p.unlocode === 'DJJIB');
  const add = await call('POST', `/ops/voyages/${ctx.voyage._id}/port-calls`, { port: djibouti._id, type: 'LOADING', planned: { eta: iso('2026-07-25T08:00', 'Africa/Djibouti') } });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  assert.equal(add.data.tasksCreated, 32); // 11 pre-arrival + 9 at port + 12 after sailing
  const cancel = await call('DELETE', `/ops/voyages/${ctx.voyage._id}/port-calls/${add.data.portCall._id}`);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.tasksCancelled, 32);
  const tasks = (await call('GET', `/ops/voyages/${ctx.voyage._id}/tasks?portCall=${add.data.portCall._id}`)).data.tasks;
  assert.ok(tasks.every((t) => t.status === 'NA' && t.naReason === 'Port call cancelled'));
});

test('access: an operator also sees a voyage where they are assigned a task', async () => {
  const before = (await call('GET', '/ops/voyages?status=ALL', null, 'ops2')).data.items.length;
  assert.equal(before, 0);
  const VoyageTask = require('../../models/ops/VoyageTask');
  await VoyageTask.updateOne({ voyage: ctx.voyage._id, code: 'T001' }, { $push: { assignedTo: ctx.e2 } });
  const list = (await call('GET', '/ops/voyages?status=ALL', null, 'ops2')).data;
  assert.equal(list.items.length, 1);
  assert.equal(list.counts.ALL, 1);
  assert.equal((await call('GET', `/ops/voyages/${ctx.voyage._id}`, null, 'ops2')).status, 200);
  assert.equal((await call('GET', '/ops/voyages?status=ALL', null, 'ops1')).data.items.length, 1);
});

test('voyage-level date change (re-delivery) recalculates the notices and is logged', async () => {
  const { status, data } = await call('PUT', `/ops/voyages/${ctx.voyage._id}`,
    { redelivery: { estimated: iso('2026-07-29T05:30', 'Asia/Kolkata') }, reason: 'Slower discharge' });
  assert.equal(status, 200, JSON.stringify(data));
  const moved = new Map(data.movedTasks.map((m) => [m.code, m]));
  assert.equal(moved.get('T093').to, '2026-07-14'); // 29-Jul − 15
  const revisions = (await call('GET', `/ops/voyages/${ctx.voyage._id}/revisions`)).data;
  assert.ok(revisions.some((r) => r.field === 'redelivery.estimated' && r.reason === 'Slower discharge'));
});

test('activity feed: activation and key-date changes with reasons, without the automatic task entries', async () => {
  const { status, data } = await call('GET', `/ops/voyages/${ctx.voyage._id}/activity`);
  assert.equal(status, 200);
  const items = data.items;
  assert.ok(items.some((i) => i.kind === 'voyage' && /Voyage activated: 128 tasks created/.test(i.text)));
  assert.ok(items.some((i) => i.kind === 'voyage' && /Djibouti \(load\) added to the rotation; 32 tasks created/.test(i.text)));
  assert.ok(items.some((i) => i.kind === 'voyage' && /Djibouti \(load\) cancelled; 32 open task/.test(i.text)));
  const eta = items.find((i) => i.kind === 'date' && i.field === 'planned.eta' && i.port === 'Salalah');
  assert.equal(eta.reason, 'Delay at previous port');
  assert.equal(eta.zone, 'Asia/Muscat');
  assert.ok(!items.some((i) => i.kind === 'task'), 'generation / recalculation entries are not listed one by one');
  const sorted = [...items].sort((a, b) => new Date(b.at) - new Date(a.at));
  assert.deepEqual(items.map((i) => i.at), sorted.map((i) => i.at), 'newest first');
});

// ------------------------------------------------------------------ step 7: working on tasks
const patchTask = (id, body, who = 'admin') => call('PATCH', `/ops/tasks/${id}`, body, who);
const freshTasks = async () => (await call('GET', `/ops/voyages/${ctx.voyage._id}/tasks`)).data.tasks;

test('task status: start date on Initiated, one-click Done = today, future completion and N/A without reason refused, re-open clears completion', async () => {
  const t = taskByCode(await freshTasks(), 'T002');
  const started = await patchTask(t._id, { status: 'INITIATED' });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.equal(started.data.task.status, 'INITIATED');
  assert.ok(started.data.task.startDate);
  const today = (await call('GET', '/ops/tasks/mine')).data.today;
  const done = await patchTask(t._id, { status: 'DONE' });
  assert.equal(done.data.task.completedDate, today);
  assert.equal(done.data.task.bucket, 'CLOSED');
  assert.equal((await patchTask(t._id, { completedDate: '2999-01-01' })).status, 400);
  const back = await patchTask(t._id, { status: 'NOT_STARTED' });
  assert.equal(back.data.task.completedDate, null);
  assert.equal((await patchTask(t._id, { status: 'NA' })).status, 400);
  const na = await patchTask(t._id, { status: 'NA', naReason: 'Handled by owners' });
  assert.equal(na.data.task.naReason, 'Handled by owners');
  const full = (await call('GET', `/ops/tasks/${t._id}`)).data;
  const fields = full.history.filter((h) => !h.auto).map((h) => h.field);
  assert.ok(fields.includes('status') && fields.includes('naReason') && fields.includes('completedDate'));
  assert.equal(full.history.find((h) => h.field === 'naReason').by.username, 'admin');
});

test('due date set by hand is locked against recalculation until unlocked', async () => {
  const t = taskByCode(await freshTasks(), 'T100', 3); // Appoint Discharge Port Agents (Kakinada ETA based)
  const set = await patchTask(t._id, { dueDate: '2026-07-05' });
  assert.equal(set.data.task.dueOverridden, true);
  const url = `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.kakinada._id}`;
  const kak = (await call('GET', `/ops/voyages/${ctx.voyage._id}`)).data.portCalls.find((p) => p._id === ctx.calls.kakinada._id);
  const later = new Date(new Date(kak.planned.eta).getTime() + 2 * 86400000).toISOString();
  const r = await call('PUT', url, { planned: { eta: later }, reason: 'Slow steaming' });
  assert.ok(!r.data.movedTasks.some((m) => String(m.id) === String(t._id)), 'locked task did not move');
  const unlocked = await patchTask(t._id, { unlockDueDate: true });
  assert.equal(unlocked.data.task.dueOverridden, false);
  assert.notEqual(unlocked.data.task.dueDate, '2026-07-05', 'recalculated from the anchor again');
});

test('completing a task with a linked field records the date on the voyage (C5) and moves dependent tasks', async () => {
  const tasks = await freshTasks();
  const t037 = taskByCode(tasks, 'T037'); // Bunker to be Booked → bunker.bookedOn
  assert.equal(taskByCode(tasks, 'T041').dueDate, null);
  const r = await patchTask(t037._id, { status: 'DONE', linkedValue: iso('2026-07-02T15:00', 'Asia/Kolkata') });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.task.status, 'DONE');
  assert.ok(r.data.movedTasks.some((m) => m.code === 'T041'), 'task waiting for the bunker booking got a date');
  const v = (await call('GET', `/ops/voyages/${ctx.voyage._id}`)).data;
  assert.equal(v.bunker.bookedOn, iso('2026-07-02T15:00', 'Asia/Kolkata'));
  const revisions = (await call('GET', `/ops/voyages/${ctx.voyage._id}/revisions`)).data;
  assert.ok(revisions.some((x) => x.field === 'bunker.bookedOn' && /Bunker to be Booked/.test(x.reason)));
  const none = await patchTask(taskByCode(tasks, 'T001')._id, { linkedValue: iso('2026-07-02T15:00', 'Asia/Kolkata') });
  assert.equal(none.status, 400, 'a task without a linked field cannot record a date');
});

test('entering a linked field ticks tasks set to complete automatically (D9)', async () => {
  const VoyageTask = require('../../models/ops/VoyageTask');
  const t111 = taskByCode(await freshTasks(), 'T111', 3);
  await VoyageTask.updateOne({ _id: t111._id }, { $set: { autoCompleteOnField: true } });
  const url = `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.kakinada._id}`;
  const r = await call('PUT', url, { actual: { ata: iso('2026-07-24T06:00', 'Asia/Kolkata'), norTendered: iso('2026-07-24T07:00', 'Asia/Kolkata') } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.autoCompleted, 1);
  const after = (await call('GET', `/ops/tasks/${t111._id}`)).data;
  assert.equal(after.status, 'DONE');
  assert.ok(after.history.some((h) => /Completed automatically/.test(h.note || '')));
});

test('bulk change, ad-hoc task on an active voyage, my tasks across voyages', async () => {
  const tasks = await freshTasks();
  const ids = ['T003', 'T004'].map((c) => taskByCode(tasks, c)._id);
  const bulk = await call('POST', '/ops/tasks/bulk', { ids, patch: { priority: 'HIGH', addAssignees: [ctx.e2] } });
  assert.equal(bulk.status, 200, JSON.stringify(bulk.data));
  assert.equal(bulk.data.updated, 2);
  const naBulk = await call('POST', '/ops/tasks/bulk', { ids, patch: { status: 'NA' } });
  assert.equal(naBulk.data.updated, 0);
  assert.equal(naBulk.data.skipped.length, 2, 'N/A without a reason is skipped');
  const doneId = taskByCode(tasks, 'T001')._id;
  await patchTask(doneId, { status: 'DONE' });
  const dueBulk = await call('POST', '/ops/tasks/bulk', { ids: [...ids, doneId], patch: { dueDate: '2026-08-01' } });
  assert.equal(dueBulk.data.updated, 2);
  assert.deepEqual(dueBulk.data.skipped.map((x) => x.reason), ['Done / N/A tasks keep their due date']);

  const add = await call('POST', `/ops/voyages/${ctx.voyage._id}/tasks`, { name: 'Send cargo docs to bank', dueDate: '2026-07-30', priority: 'LOW', assignedTo: [ctx.e2] });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  assert.equal(add.data.dueOverridden, true);
  assert.equal(add.data.assignedTo[0].employeeName, 'Test Op Two');
  assert.equal((await call('POST', `/ops/voyages/${ctx.voyage._id}/tasks`, { name: '' })).status, 400);

  const mine = (await call('GET', '/ops/tasks/mine', null, 'ops2')).data;
  const names = mine.tasks.map((t) => t.baseName || t.name);
  assert.ok(names.includes('Send cargo docs to bank'));
  assert.ok(mine.tasks.every((t) => t.voyage.voyageNo && t.status !== 'DONE'));
  assert.equal(mine.total, mine.tasks.length);
  const adminMine = (await call('GET', '/ops/tasks/mine')).data;
  assert.equal(adminMine.notLinked, true, 'admin has no employee record, so no personal tasks');
});

test('task attachments: upload, download, remove; operators outside the voyage cannot see the task', async () => {
  const t = taskByCode(await freshTasks(), 'T005');
  const form = new FormData();
  form.append('file', new Blob(['hello recap'], { type: 'text/plain' }), 'recap.txt');
  const up = await fetch(`${API}/ops/tasks/${t._id}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.admin}` }, body: form });
  assert.equal(up.status, 201);
  const att = (await up.json()).attachments[0];
  assert.equal(att.fileName, 'recap.txt');
  const dl = await fetch(`${API}/ops/tasks/${t._id}/attachments/${att._id}`, { headers: { Authorization: `Bearer ${tokens.admin}` } });
  assert.equal(await dl.text(), 'hello recap');
  const VoyageTask = require('../../models/ops/VoyageTask');
  const Voyage = require('../../models/ops/Voyage');
  // ops2 sees the voyage only through assigned tasks: remove them and the task disappears for ops2
  await VoyageTask.updateMany({ voyage: ctx.voyage._id }, { $pull: { assignedTo: ctx.e2 } });
  assert.equal((await call('GET', `/ops/tasks/${t._id}`, null, 'ops2')).status, 404);
  assert.equal((await call('PATCH', `/ops/tasks/${t._id}`, { priority: 'LOW' }, 'ops2')).status, 404);
  const del = await call('DELETE', `/ops/tasks/${t._id}/attachments/${att._id}`);
  assert.equal(del.status, 200);
  assert.equal(del.data.attachments.length, 0);
  await Voyage.updateOne({ _id: ctx.voyage._id }, { $set: { status: 'COMPLETED' } });
  assert.equal((await patchTask(t._id, { priority: 'LOW' })).status, 400, 'tasks of a completed voyage are frozen');
  await Voyage.updateOne({ _id: ctx.voyage._id }, { $set: { status: 'ACTIVE' } });
  require('node:fs').rmSync(path.join(require('../../routes/ops/tasks').STORAGE, String(ctx.voyage._id)), { recursive: true, force: true });
});

// ------------------------------------------------------------------ step 8: daily checks and recurring tasks
const checksUrl = () => `/ops/voyages/${ctx.voyage._id}/daily-checks`;

test('daily checklist: today\'s log from the vessel status, created once; past / future dates', async () => {
  await call('PUT', `/ops/voyages/${ctx.voyage._id}/vessel-status`, { value: 'AT_DISCHARGE_PORT' }); // Kakinada: ATA only = Waiting for Berth
  // Earlier tests moved the vessel through several statuses today, each adding its checks; start a fresh day
  await require('../../models/ops/DailyCheckLog').deleteMany({ voyage: ctx.voyage._id });
  const { status, data } = await call('GET', checksUrl());
  assert.equal(status, 200, JSON.stringify(data));
  assert.equal(data.vesselStatus, 'AT_DISCHARGE_PORT');
  assert.equal(data.log.items.length, 8);
  assert.ok(data.log.items.some((i) => i.name === 'Update ETC Discharge Port' && i.linkedField === 'portCall.DISCHARGING.planned.etc'));
  assert.equal(data.editable, true);
  const again = (await call('GET', checksUrl())).data;
  assert.equal(again.log._id, data.log._id);
  assert.equal(again.history.length, 1);
  assert.equal(again.history[0].total, 8);
  const { DateTime } = require('luxon');
  const past = (await call('GET', `${checksUrl()}?date=${DateTime.fromISO(data.today).minus({ days: 3 }).toISODate()}`)).data;
  assert.equal(past.log, null);
  assert.equal(past.editable, false);
  const future = (await call('GET', `${checksUrl()}?date=${DateTime.fromISO(data.today).plus({ days: 2 }).toISODate()}`)).data;
  assert.equal(future.preview.length, 8);
  assert.equal(future.editable, false);
  ctx.checks = data.log;
});

test('daily checklist: tick with who / when and a remark; other operators cannot', async () => {
  const item = ctx.checks.items.find((i) => i.name === 'Check Weather Updates');
  const r = await call('PATCH', `${checksUrl()}/items/${item._id}`, { done: true, remark: 'Calm, no swell' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const after = r.data.log.items.find((i) => i._id === item._id);
  assert.equal(after.done, true);
  assert.equal(after.doneBy.username, 'admin');
  assert.ok(after.doneAt);
  assert.equal(after.remark, 'Calm, no swell');
  assert.equal(r.data.history[0].done, 1);
  assert.equal((await call('PATCH', `${checksUrl()}/items/${item._id}`, { done: false }, 'ops2')).status, 404);
  const undo = await call('PATCH', `${checksUrl()}/items/${item._id}`, { done: false });
  assert.equal(undo.data.log.items.find((i) => i._id === item._id).doneBy, null);
  await call('PATCH', `${checksUrl()}/items/${item._id}`, { done: true });
});

test('daily checklist: entering a linked date ticks its check (D9); a status change adds the new set and keeps ticks', async () => {
  const kak = (await call('GET', `/ops/voyages/${ctx.voyage._id}`)).data.portCalls.find((p) => p._id === ctx.calls.kakinada._id);
  const etc = new Date(new Date(kak.planned.etc).getTime() + 6 * 3600000).toISOString();
  const r = await call('PUT', `/ops/voyages/${ctx.voyage._id}/port-calls/${ctx.calls.kakinada._id}`, { planned: { etc } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.checksTicked, 1);
  let log = (await call('GET', checksUrl())).data.log;
  const upd = log.items.find((i) => i.name === 'Update ETC Discharge Port');
  assert.equal(upd.done, true);
  assert.equal(upd.auto, true);
  assert.match(upd.autoNote, /Ticked automatically when Port call – ETC was entered/);

  await call('PUT', `/ops/voyages/${ctx.voyage._id}/vessel-status`, { value: 'ENROUTE_DISCHARGE_PORT' });
  const d = (await call('GET', checksUrl())).data;
  log = d.log;
  assert.equal(d.vesselStatus, 'ENROUTE_DISCHARGE_PORT');
  assert.deepEqual(log.statuses, ['AT_DISCHARGE_PORT', 'ENROUTE_DISCHARGE_PORT']);
  assert.equal(log.items.length, 12, '4 new checks; the 4 with the same name as today\'s are not repeated');
  assert.equal(log.items.filter((i) => i.done).length, 2, 'ticks of the first set are kept');
  await call('PUT', `/ops/voyages/${ctx.voyage._id}/vessel-status`, { value: null });
});

test('recurring hire payment: repeats generated up to a week ahead until re-delivery; a shorter cycle closes the extra ones', async () => {
  const { DateTime } = require('luxon');
  const r = await call('PUT', `/ops/voyages/${ctx.voyage._id}`, { redelivery: { estimated: iso('2026-12-31T12:00', 'Asia/Kolkata') } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const hire = async () => (await call('GET', checksUrl())).data.recurring;
  let list = await hire();
  const first = list.find((t) => t.recurrenceIndex === 0);
  const today = (await call('GET', checksUrl())).data.today;
  const limit = DateTime.fromISO(today).plus({ days: 7 }).toISODate();
  const expected = [];
  for (let k = 0; ; k++) {
    const d = DateTime.fromISO(first.dueDate).plus({ days: 15 * k }).toISODate();
    if (d > '2026-12-31' || d > limit) break;
    expected.push(d);
  }
  assert.deepEqual(list.map((t) => t.dueDate), expected);
  assert.equal(list[1].baseName, 'Next Hire Payment #2');
  assert.equal(list[1].assignedTo.length, first.assignedTo.length);
  assert.equal((await call('GET', checksUrl())).data.recurring.length, expected.length, 'not generated twice');

  // Re-delivery 10 days after the first payment: only #1 (and #2 if inside) stay open
  const end = DateTime.fromISO(first.dueDate).plus({ days: 10 }).toISODate();
  await call('PUT', `/ops/voyages/${ctx.voyage._id}`, { redelivery: { estimated: iso(`${end}T12:00`, 'Asia/Kolkata') } });
  list = await hire();
  assert.equal(list.length, expected.length);
  assert.ok(list.filter((t) => t.recurrenceIndex > 0).every((t) => t.status === 'NA' && /recurring cycle/.test(t.naReason)));
  assert.equal(list[0].status, 'NOT_STARTED');
});

// ------------------------------------------------------------------ step 9: scheduled jobs, reminders, digest, escalation
const runJob = (name) => call('POST', `/ops/jobs/${name}/run`);
const emails = async (q = '') => (await call('GET', `/ops/jobs/emails?limit=200${q}`)).data;

test('jobs: admin sees the five jobs; others are refused', async () => {
  const { status, data } = await call('GET', '/ops/jobs');
  assert.equal(status, 200);
  assert.deepEqual(data.jobs.map((j) => j.name).sort(), ['ops-daily-checks', 'ops-daily-digest', 'ops-escalation', 'ops-recurring', 'ops-reminder-scan']);
  assert.equal(data.jobs.find((j) => j.name === 'ops-daily-digest').schedule, 'Daily at 07:30');
  assert.ok(data.jobs.every((j) => j.nextRunAt));
  assert.equal(data.emailConfigured, false);
  assert.equal((await call('GET', '/ops/jobs', null, 'ops1')).status, 403);
  assert.equal((await call('POST', '/ops/jobs/nope/run')).status, 404);
});

test('reminder scan: one email + bell per assignee, never twice; HIGH gets the day-before reminder, LOW no overdue reminder', async () => {
  const Notification = require('../../models/Notification');
  const User = require('../../models/User');
  const ops1 = await User.findOne({ username: 'ops1' });
  const r = await runJob('ops-reminder-scan');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.result.tasks > 50, `overdue tasks reminded: ${r.data.result.tasks}`);
  const mail = (await emails('&kind=REMINDER')).find((e) => e.to === 'ops1@auxin.local');
  assert.ok(mail, 'reminder email for Test Op One');
  assert.equal(mail.status, 'SKIPPED', 'email is not configured in tests');
  assert.match(mail.subject, /^Vessel ops reminder: \d+ overdue/);
  const html = (await call('GET', `/ops/jobs/emails/${mail._id}`)).data.html;
  assert.ok(html.includes(ctx.voyage.voyageNo) && html.includes('Overdue'));
  assert.ok(await Notification.exists({ userId: ops1._id, 'payload.type': 'ops-reminder' }));

  const again = await runJob('ops-reminder-scan');
  assert.equal(again.data.result.tasks, 0, 'nothing is reminded twice on the same day');

  const { DateTime } = require('luxon');
  const today = (await call('GET', '/ops/tasks/mine')).data.today;
  const open = (await freshTasks()).filter((t) => ['NOT_STARTED', 'INITIATED'].includes(t.status) && t.assignedTo.length);
  const [a, b] = open;
  await patchTask(a._id, { priority: 'HIGH', dueDate: DateTime.fromISO(today).plus({ days: 1 }).toISODate() });
  await patchTask(b._id, { priority: 'LOW', dueDate: DateTime.fromISO(today).minus({ days: 1 }).toISODate() });
  const third = await runJob('ops-reminder-scan');
  assert.equal(third.data.result.tasks, 1, 'only the HIGH task due tomorrow');
  const latest = (await emails('&kind=REMINDER'))[0];
  assert.match(latest.subject, /1 due tomorrow/);
});

test('escalation: overdue beyond the limit goes to the managers once', async () => {
  const User = require('../../models/User');
  await User.create({ username: 'mgr', password: 'x', role: 'chartering_manager', emailId: 'mgr@auxin.local' });
  const r = await runJob('ops-escalation');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.result.tasks > 50);
  assert.equal(r.data.result.recipients, 1);
  const mail = (await emails('&kind=ESCALATION'))[0];
  assert.equal(mail.to, 'mgr@auxin.local');
  assert.match(mail.subject, /^Escalation: \d+ tasks overdue beyond the limit/);
  assert.equal((await runJob('ops-escalation')).data.result.tasks, 0, 'each task escalates once per due date');
});

test('morning summary: per operator and vessel, with today\'s checks', async () => {
  const r = await runJob('ops-daily-digest');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.result.people >= 1);
  const mail = (await emails('&kind=DIGEST')).find((e) => e.to === 'ops1@auxin.local');
  assert.match(mail.subject, /^Morning summary \d\d-\w{3}-\d{4}: \d+ overdue, \d+ due today, \d+ checks/);
  const html = (await call('GET', `/ops/jobs/emails/${mail._id}`)).data.html;
  assert.ok(html.includes(ctx.voyage.voyageNo) && html.includes('Today\'s checks'));
});

test('night jobs: daily checklists are started; recurring tasks run without duplicates', async () => {
  const DailyCheckLog = require('../../models/ops/DailyCheckLog');
  await DailyCheckLog.deleteMany({ voyage: ctx.voyage._id });
  const r = await runJob('ops-daily-checks');
  assert.equal(r.data.result.voyages, 1);
  assert.ok(await DailyCheckLog.exists({ voyage: ctx.voyage._id }));
  const rec = await runJob('ops-recurring');
  assert.equal(rec.data.error, null);
  assert.equal(rec.data.result.created, 0);
  const jobs = (await call('GET', '/ops/jobs')).data.jobs;
  assert.equal(jobs.find((j) => j.name === 'ops-daily-checks').lastTrigger, 'manual');
});

test('ETA change: assignees other than the editor are told which of their tasks moved', async () => {
  const Notification = require('../../models/Notification');
  const User = require('../../models/User');
  const ops1 = await User.findOne({ username: 'ops1' });
  // (the port calls all have actual arrivals by now, so a planned ETA no longer moves anything: change re-delivery)
  const v = (await call('GET', `/ops/voyages/${ctx.voyage._id}`)).data;
  const before = await Notification.countDocuments({ userId: ops1._id, 'payload.type': 'ops-eta-change' });
  const r = await call('PUT', `/ops/voyages/${ctx.voyage._id}`,
    { redelivery: { estimated: new Date(new Date(v.redelivery.estimated).getTime() + 5 * 86400000).toISOString() }, reason: 'Slow discharge' });
  assert.ok(r.data.movedTasks.length > 0);
  let n = before;
  for (let i = 0; i < 20 && n === before; i++) {
    await new Promise((res) => setTimeout(res, 100));
    n = await Notification.countDocuments({ userId: ops1._id, 'payload.type': 'ops-eta-change' });
  }
  assert.equal(n, before + 1);
  const note = await Notification.findOne({ userId: ops1._id, 'payload.type': 'ops-eta-change' }).sort({ createdAt: -1 });
  assert.match(note.title, /dates changed by admin/);
  assert.match(note.body, /of your tasks? moved/);
});

// ------------------------------------------------------------------ step 10: Report View and fleet dashboard
test('Report View: counts equal the Operations View totals (scope §13); N/A left out; on-time %', async () => {
  const { status, data: r } = await call('GET', `/ops/voyages/${ctx.voyage._id}/report`);
  assert.equal(status, 200, JSON.stringify(r));
  const ov = (await call('GET', `/ops/voyages/${ctx.voyage._id}/tasks`)).data;
  assert.deepEqual(r.byBucket, ov.byBucket, 'same bucket counts as the Operations View');
  assert.equal(r.totals.tasks, ov.total);
  const na = ov.tasks.filter((t) => t.status === 'NA').length;
  const done = ov.tasks.filter((t) => t.status === 'DONE');
  assert.equal(r.totals.notApplicable, na);
  assert.equal(r.totals.counted, ov.total - na);
  assert.equal(r.totals.done, done.length);
  assert.equal(r.byStatus.DONE + r.byStatus.NOT_STARTED + r.byStatus.INITIATED + r.byStatus.AWAITING, r.totals.counted);
  assert.equal(r.totals.pctComplete, Math.round((done.length / r.totals.counted) * 1000) / 10);
  const withDue = done.filter((t) => t.dueDate);
  assert.equal(r.totals.onTime, withDue.filter((t) => t.overdueDays === 0).length);
  assert.equal(r.byStage.reduce((n, g) => n + g.total, 0), r.totals.counted);
  assert.equal(r.overdue.length, ov.byBucket.OVERDUE);
  assert.ok(r.overdue[0].overdueDays >= r.overdue[r.overdue.length - 1].overdueDays, 'most overdue first');
  const salalah = r.portTimeline.find((p) => p.name === 'Salalah');
  assert.equal(r.portTimeline[0].kind, 'DELIVERY');
  assert.equal(r.portTimeline[r.portTimeline.length - 1].kind, 'REDELIVERY');
  const arr = salalah.events.find((e) => e.key === 'arrival');
  assert.equal(arr.delayMinutes, Math.round((new Date(arr.actual) - new Date(arr.original)) / 60000));
});

test('fleet dashboard: cards, KPIs and tasks due today; scope by user, operator filter cannot widen it', async () => {
  const admin = (await call('GET', '/ops/dashboard')).data;
  assert.equal(admin.kpis.activeVoyages, 1);
  const card = admin.voyages[0];
  const r = (await call('GET', `/ops/voyages/${ctx.voyage._id}/report`)).data;
  assert.equal(card.counts.overdue, r.byBucket.OVERDUE);
  assert.equal(admin.kpis.overdue, card.counts.overdue);
  assert.equal(card.voyageNo, ctx.voyage.voyageNo);
  assert.ok(card.currentPort || card.nextPort || card.redelivery);
  assert.equal(admin.tasksScope, 'all');
  assert.equal(admin.canFilterOperator, true);
  assert.equal(admin.tasksToday.length, card.counts.today);

  const ops1 = (await call('GET', '/ops/dashboard', null, 'ops1')).data;
  assert.equal(ops1.tasksScope, 'mine');
  assert.equal(ops1.canFilterOperator, false);
  assert.equal(ops1.voyages.length, 1);

  const ops2 = (await call('GET', `/ops/dashboard?operator=${ops1.myEmployeeId}`, null, 'ops2')).data;
  assert.equal(ops2.voyages.length, 0, 'ops2 sees no voyage, whatever the operator filter');
  assert.equal((await call('GET', `/ops/dashboard?operator=${ctx.e2}`)).data.voyages.length, 0, 'Test Op Two operates no voyage');
  assert.equal((await call('GET', '/ops/dashboard?operator=bad')).status, 400);
});
