// Brings a Phase 1 database up to Phase 2 (Vessel Operations). Safe to re-run.
//
//   node scripts/migratePhase2.js           check only: reports what would change, writes nothing
//   node scripts/migratePhase2.js --apply   make the changes
//
// Run from the server/ folder. Uses MONGO_URI from .env, or from the environment:
//   MONGO_URI="mongodb+srv://…/auxin_db" node scripts/migratePhase2.js
//
// Phase 2 does not change the Phase 1 collections (users, employees, clients, tasks, meetings …),
// so nothing is converted. The patch:
//   1. checks the database is a replica set (Phase 2 saves voyages in transactions; Atlas always is)
//   2. creates the Phase 2 collections and their indexes
//   3. seeds the Vessel Operations masters (stages, 127 task templates, daily checks, ports, sample vessel)
//      by running scripts/seedOps.js — adds what is missing, never overwrites edits made in the app
//   4. links login users to their employee record by email (User.employeeId), which "My Tasks",
//      task assignment and operator access need
//   5. reports what still needs a person: users without an operations role, clients without the
//      types the voyage form lists (Charterer, Owner, Agent, Broker), passwords stored in plain text
require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const { ALL_OPS, ADMIN, MANAGERS, OPERATORS, READ_ONLY } = require('../services/ops/roles');

const APPLY = process.argv.includes('--apply');
const OPS_MODELS_DIR = path.join(__dirname, '..', 'models', 'ops');
const VOYAGE_FORM_CLIENT_TYPES = ['Charterer', 'Owner', 'Agent', 'Broker'];

const norm = (s) => String(s || '').trim().toLowerCase();
const line = (s = '') => console.log(s);
const head = (n, s) => line(`\n${n}. ${s}`);

function hostOf(uri) {
  try { return new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).host; } catch (e) { return '(unparsed)'; }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  line(`Phase 2 patch — ${APPLY ? 'APPLY (writes changes)' : 'CHECK ONLY (nothing is written; add --apply)'}`);
  line(`Database: ${db.databaseName} on ${hostOf(uri)}`);

  const [users, employees, clients] = await Promise.all([User.countDocuments(), Employee.countDocuments(), Client.countDocuments()]);
  line(`Phase 1 data: ${users} users, ${employees} employees, ${clients} clients`);
  let problems = 0;

  // 1 -------------------------------------------------------------- replica set
  head(1, 'Transactions (replica set)');
  const hello = await db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === 'isdbgrid') {
    line(`   OK — replica set "${hello.setName || 'sharded'}"`);
  } else {
    problems++;
    line('   PROBLEM — a standalone MongoDB cannot run transactions; creating or editing a voyage will fail.');
    line('   Start mongod with --replSet rs0, run rs.initiate() once, and add ?replicaSet=rs0 to MONGO_URI.');
  }

  // 2 -------------------------------------------------------------- collections and indexes
  head(2, 'Phase 2 collections and indexes');
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const models = fs.readdirSync(OPS_MODELS_DIR).filter((f) => f.endsWith('.js')).map((f) => require(path.join(OPS_MODELS_DIR, f)));
  const missing = models.filter((m) => !existing.has(m.collection.collectionName));
  line(`   ${models.length - missing.length} of ${models.length} exist${missing.length ? `; missing: ${missing.map((m) => m.collection.collectionName).join(', ')}` : ''}`);
  if (APPLY) {
    for (const m of models) {
      if (!existing.has(m.collection.collectionName)) await m.createCollection();
      await m.init(); // builds the indexes declared in the schema
    }
    line('   Done — collections created and indexes built');
  }

  // 3 -------------------------------------------------------------- masters
  head(3, 'Vessel Operations masters');
  const counts = Object.fromEntries(await Promise.all(['opsstages', 'tasktemplates', 'dailychecktemplates', 'ports', 'vessels']
    .map(async (c) => [c, existing.has(c) ? await db.collection(c).countDocuments() : 0])));
  line(`   Now: ${counts.opsstages} stages, ${counts.tasktemplates} task templates, ${counts.dailychecktemplates} daily check sets, ${counts.ports} ports, ${counts.vessels} vessels`);
  if (APPLY) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'seedOps.js')], { env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8' });
    process.stdout.write(r.stdout.split('\n').map((l) => (l ? `   ${l}` : l)).join('\n'));
    if (r.status !== 0) throw new Error(`seedOps.js failed: ${r.stderr || r.stdout}`);
  } else if (counts.tasktemplates === 0) {
    line('   Will seed: 19 stages, 127 task templates, daily check sets, ports and the sample vessel');
  } else {
    line('   Will add only what is missing (edits made in the app are kept)');
  }

  // 4 -------------------------------------------------------------- users ↔ employees
  head(4, 'Link login users to employees (by email)');
  const allUsers = await User.find().select('username emailId role employeeId').lean();
  const allEmployees = await Employee.find().select('employeeName emailId').lean();
  const empByEmail = new Map();
  for (const e of allEmployees) {
    const k = norm(e.emailId);
    if (k) empByEmail.set(k, empByEmail.has(k) ? null : e); // null = ambiguous
  }
  const takenEmployees = new Set(allUsers.filter((u) => u.employeeId).map((u) => String(u.employeeId)));
  const links = [];
  const unlinkedOps = [];
  for (const u of allUsers.filter((x) => !x.employeeId)) {
    const e = empByEmail.get(norm(u.emailId));
    if (e && !takenEmployees.has(String(e._id))) {
      links.push({ user: u, employee: e });
      takenEmployees.add(String(e._id));
    } else if (ALL_OPS.includes(u.role) && !ADMIN.includes(u.role)) {
      unlinkedOps.push({ user: u, why: !norm(u.emailId) ? 'user has no email' : e === null ? 'several employees share the email' : e ? 'employee already linked to another user' : 'no employee with that email' });
    }
  }
  line(`   Already linked: ${allUsers.filter((u) => u.employeeId).length}. ${APPLY ? 'Linked now' : 'Will link'}: ${links.length}`);
  for (const { user, employee } of links) line(`     ${user.username} → ${employee.employeeName} <${employee.emailId}>`);
  if (APPLY && links.length) {
    await User.bulkWrite(links.map(({ user, employee }) => ({ updateOne: { filter: { _id: user._id, employeeId: null }, update: { $set: { employeeId: employee._id } } } })));
  }
  if (unlinkedOps.length) {
    problems++;
    line(`   Needs a person — operations users without an employee (they cannot be assigned tasks or see "My Tasks"):`);
    for (const { user, why } of unlinkedOps) line(`     ${user.username} (${user.role}): ${why}`);
    line('   Fix: give the user and the employee the same email, then re-run; or pick the employee in User Management.');
  }

  // 5 -------------------------------------------------------------- reports
  head(5, 'For a person to review');
  const byRole = {};
  for (const u of allUsers) byRole[u.role] = (byRole[u.role] || 0) + 1;
  const group = (roles) => roles.map((r) => `${r} ${byRole[r] || 0}`).join(', ');
  line(`   Operations access — admin: ${group(ADMIN)}; managers: ${group(MANAGERS)}; operators: ${group(OPERATORS)}; read-only: ${group(READ_ONLY)}`);
  const noOps = Object.entries(byRole).filter(([r]) => !ALL_OPS.includes(r));
  if (noOps.length) line(`   No Vessel Operations menu (Phase 1 only): ${noOps.map(([r, n]) => `${r} ${n}`).join(', ')}`);
  if (!OPERATORS.some((r) => byRole[r])) {
    problems++;
    line('   Needs a person — no user has an operator role (operations_executive / executive_post_fixture); nobody can run voyages day to day.');
  }

  const types = await Client.aggregate([{ $group: { _id: '$clientType', n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
  line(`   Client types: ${types.map((t) => `${t._id || '(none)'} ${t.n}`).join(', ') || 'no clients'}`);
  const missingTypes = VOYAGE_FORM_CLIENT_TYPES.filter((t) => !types.some((x) => x._id === t));
  if (missingTypes.includes('Charterer')) {
    problems++;
    line('   Needs a person — no client has type "Charterer"; the voyage form lists charterers by that type. Set it in Sales & Leads.');
  } else if (missingTypes.length) {
    line(`   No clients of type ${missingTypes.join(', ')} yet (the voyage form lists them by type)`);
  }

  const plain = await User.countDocuments({ password: { $exists: true, $ne: '', $not: /^\$2/ } });
  if (plain) line(`   ${plain} user password(s) are stored in plain text. Login still works; set HASH_PASSWORDS=true so changed passwords are hashed.`);

  line(`\n${problems ? `${problems} item(s) need a person (see above).` : 'Nothing needs a person.'}${APPLY ? '' : ' Nothing was written — run with --apply to make the changes.'}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nPatch failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
