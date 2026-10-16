// Load Leave Approvers (employee → HOD, HR) from the client's Excel sheet. Check only unless --apply.
// Sheet layout: optional company title rows, then a header row "EMPLOYEE NAME | HOD | HR/ADMIN" and one row per employee.
// Usage (in the server folder):
//   node scripts/importLeaveApprovers.js "<file.xlsx>"                      # shows what would be saved, changes nothing
//   node scripts/importLeaveApprovers.js "<file.xlsx>" --as "Santosh Galve=SANTOSH G"   # say which login a name means
//   node scripts/importLeaveApprovers.js "<file.xlsx>" --as "..." --apply   # saves; existing rows of those employees are updated
require('dotenv').config();
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');
const LeaveApprover = require('../models/LeaveApprover');
const { employeeOfUser } = require('../utils/leaveScope');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--as');
const apply = args.includes('--apply');
const overrides = new Map();
args.forEach((a, i) => {
  if (a !== '--as') return;
  const [name, login] = String(args[i + 1] || '').split('=');
  if (name && login) overrides.set(norm(name), login.trim());
});
if (!file) {
  console.error('Usage: node scripts/importLeaveApprovers.js "<file.xlsx>" [--as "Name=login"] [--apply]');
  process.exit(1);
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

// Rows under each "EMPLOYEE NAME | HOD | HR" header: { company, name, hod, hr }
function readSheet(path) {
  const wb = XLSX.readFile(path);
  const out = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', blankrows: false })
      .map((r) => r.map((c) => String(c).trim()).filter((c, i, all) => c || all.slice(i).some(Boolean)));
    let cols = null;
    let company = '';
    for (const r of rows) {
      const cells = r.filter(Boolean);
      const upper = r.map((c) => c.toUpperCase());
      const nameCol = upper.findIndex((c) => c.includes('EMPLOYEE'));
      const hodCol = upper.findIndex((c) => c === 'HOD' || c.startsWith('HOD'));
      const hrCol = upper.findIndex((c) => c.startsWith('HR'));
      if (nameCol !== -1 && (hodCol !== -1 || hrCol !== -1)) { cols = { nameCol, hodCol, hrCol }; continue; }
      if (cells.length === 1) { company = cells[0]; cols = null; continue; } // title row
      if (!cols || !r[cols.nameCol]) continue;
      out.push({ company, name: r[cols.nameCol], hod: cols.hodCol >= 0 ? r[cols.hodCol] : '', hr: cols.hrCol >= 0 ? r[cols.hrCol] : '' });
    }
  }
  return out;
}

(async () => {
  const sheet = readSheet(file);
  if (!sheet.length) { console.error('No employee rows found under an "EMPLOYEE NAME | HOD | HR" header.'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const employees = await Employee.find().select('employeeId employeeName department emailId').lean();
  const users = await User.find().select('username emailId employeeId role').lean();
  const userEmployee = new Map();
  for (const u of users) userEmployee.set(String(u._id), await employeeOfUser(u));

  const sameName = (a, b) => {
    const x = norm(a).split(' ');
    const y = norm(b).split(' ');
    if (x.join(' ') === y.join(' ')) return 'exact';
    return null;
  };
  // "SANTOSH G" for "Santosh Galve": same first name, second word is the start of the other's second word
  const shortName = (login, name) => {
    const x = norm(login).split(' ');
    const y = norm(name).split(' ');
    return x.length >= 2 && y.length >= 2 && x[0] === y[0] && y[1].startsWith(x[1]);
  };

  function findEmployee(name) {
    const hits = employees.filter((e) => sameName(e.employeeName, name));
    return hits.length === 1 ? hits[0] : null;
  }
  // The login of a person named in the sheet: --as override, else logins of their employee record plus logins with that name
  function findLogin(name) {
    const forced = overrides.get(norm(name));
    if (forced) {
      const u = users.find((x) => norm(x.username) === norm(forced));
      return u ? { user: u, how: `--as ${forced}` } : { error: `--as login "${forced}" not found` };
    }
    const emp = findEmployee(name);
    const hits = new Map();
    users.forEach((u) => {
      const e = userEmployee.get(String(u._id));
      if (emp && e && String(e._id) === String(emp._id)) hits.set(String(u._id), { u, how: 'login of employee record' });
      else if (sameName(u.username, name)) hits.set(String(u._id), { u, how: 'same username' });
      else if (shortName(u.username, name)) hits.set(String(u._id), { u, how: 'similar username' });
    });
    const list = [...hits.values()];
    if (list.length === 1) return { user: list[0].u, how: list[0].how };
    if (!list.length) return { error: 'no login found' };
    return { error: `more than one login: ${list.map((h) => `"${h.u.username}" (${h.how}, ${h.u.role})`).join(', ')} – add --as "${name}=<login>"` };
  }
  // The person in the "EMPLOYEE NAME" column: their employee record, else their login
  function findPerson(name) {
    const emp = findEmployee(name);
    if (emp) return { employee: emp, label: `employee ${emp.employeeName}${emp.employeeId ? ` (${emp.employeeId})` : ''}, ${emp.department || 'no department'}` };
    const login = findLogin(name);
    if (login.user) return { user: login.user, label: `login ${login.user.username} (no employee record)` };
    return { error: `no employee record; ${login.error}` };
  }

  let problems = 0;
  const plan = [];
  console.log(`${sheet.length} row(s) in ${file}${apply ? '' : '  (check only – add --apply to save)'}\n`);
  for (const row of sheet) {
    const person = findPerson(row.name);
    const hod = row.hod ? findLogin(row.hod) : { user: null };
    const hr = row.hr ? findLogin(row.hr) : { user: null };
    const errs = [person.error && `employee: ${person.error}`, hod.error && `HOD: ${hod.error}`, hr.error && `HR: ${hr.error}`].filter(Boolean);
    console.log(`${row.company ? `[${row.company}] ` : ''}${row.name}`);
    console.log(`   employee : ${person.label || '-'}`);
    console.log(`   HOD      : ${row.hod || '-'} → ${hod.user ? `${hod.user.username} (${hod.how})` : hod.error || '-'}`);
    console.log(`   HR       : ${row.hr || '-'} → ${hr.user ? `${hr.user.username} (${hr.how})` : hr.error || '-'}`);
    if (errs.length) { problems += 1; errs.forEach((e) => console.log(`   PROBLEM  : ${e}`)); continue; }
    const key = person.employee ? { employee: person.employee._id } : { user: person.user._id };
    const existing = await LeaveApprover.findOne(key).lean();
    const same = existing && String(existing.hod || '') === String(hod.user ? hod.user._id : '') && String(existing.hr || '') === String(hr.user ? hr.user._id : '');
    console.log(`   action   : ${!existing ? 'create' : same ? 'no change' : 'update existing row'}`);
    if (!same) plan.push({ key, hod: hod.user ? hod.user._id : null, hr: hr.user ? hr.user._id : null });
  }

  console.log(`\n${problems} row(s) with problems, ${plan.length} row(s) to create or update.`);
  if (apply) {
    if (problems) {
      console.log('Nothing saved: fix the problems above first (or use --as "Name=login").');
      process.exitCode = 1;
    } else {
      for (const p of plan) await LeaveApprover.findOneAndUpdate(p.key, { ...p.key, hod: p.hod, hr: p.hr }, { upsert: true, new: true, setDefaultsOnInsert: true });
      console.log(`Saved ${plan.length} row(s).`);
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
