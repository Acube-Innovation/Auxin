// Check of the email address on every login: login is by email, so a login without a usable, unique
// email cannot log in. Lists each problem login and the fix. Check only unless --apply, which copies
// the email of the linked employee record (User.employeeId) to logins that have none, when no other
// login uses it. Everything else is listed for Admin to correct in User Management.
// Usage (in the server folder): node scripts/checkLoginEmails.js [--apply]
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');

const apply = process.argv.includes('--apply');
const norm = (s) => String(s || '').trim().toLowerCase();
const looksLikeEmail = (s) => /^\S+@\S+\.\S+$/.test(String(s || '').trim());

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find().select('username emailId employeeId role').sort({ username: 1 }).lean();
  const employees = await Employee.find().select('employeeName emailId').lean();
  const employeeById = new Map(employees.map((e) => [String(e._id), e]));
  const usersOfEmail = new Map();
  users.forEach((u) => { const k = norm(u.emailId); if (k) usersOfEmail.set(k, (usersOfEmail.get(k) || 0) + 1); });

  const problems = [];
  const fixes = [];
  for (const u of users) {
    const email = norm(u.emailId);
    const employee = u.employeeId ? employeeById.get(String(u.employeeId)) : null;
    const employeeEmail = employee ? norm(employee.emailId) : '';
    if (!email) {
      if (employeeEmail && looksLikeEmail(employeeEmail) && !usersOfEmail.has(employeeEmail)) {
        fixes.push({ u, email: String(employee.emailId).trim() });
        usersOfEmail.set(employeeEmail, 1);
        problems.push([u, `no email; ${apply ? 'set to' : 'will be set to'} ${String(employee.emailId).trim()} from employee ${employee.employeeName}`]);
      } else {
        const sameName = employees.filter((e) => norm(e.employeeName) === norm(u.username));
        const hint = sameName.length === 1 && sameName[0].emailId ? ` (employee "${sameName[0].employeeName}" has ${sameName[0].emailId})` : '';
        problems.push([u, `no email – cannot log in. Admin: add the email in User Management${hint}`]);
      }
    } else if (!looksLikeEmail(email)) {
      problems.push([u, `email "${u.emailId}" is not a valid address – cannot log in. Admin: correct it in User Management`]);
    } else if (usersOfEmail.get(email) > 1) {
      problems.push([u, `email ${u.emailId} is also on another login – neither can log in. Admin: give each login its own email`]);
    } else if (employeeEmail && employeeEmail !== email) {
      problems.push([u, `logs in with ${u.emailId}; the linked employee record has ${employee.emailId} (that one opens this login only if no login has it)`]);
    }
  }

  console.log(`Logins: ${users.length}; with a problem: ${problems.length}${apply ? '' : ' (check only – nothing changed; add --apply to fill emails from employee records)'}`);
  problems.forEach(([u, why]) => console.log(`  ${u.username} (${u.role}): ${why}`));

  if (apply && fixes.length) {
    for (const f of fixes) await User.updateOne({ _id: f.u._id }, { $set: { emailId: f.email } });
    console.log(`\nEmail set on ${fixes.length} login(s).`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
