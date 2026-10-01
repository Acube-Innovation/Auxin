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
const ENV = { ...process.env, MONGO_URI: TEST_URI, PORT: String(PORT), EMAIL_USER: '', EMAIL_PASS: '' };
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
