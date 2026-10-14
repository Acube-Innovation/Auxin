// Read-only check for leave approval by department HOD.
// Lists every HOD login with the department it approves for, and every other login whose leave requests
// would reach Admin only (no department, or no HOD in its department). Changes nothing.
// Usage (in the server folder): node scripts/checkLeaveHods.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { departmentOfUser } = require('../utils/leaveScope');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find().select('username role emailId employeeId').sort({ username: 1 }).lean();
  const withDept = [];
  for (const u of users) withDept.push({ ...u, department: await departmentOfUser(u) });

  const hods = withDept.filter((u) => u.role === 'hod');
  const hodDepts = new Set(hods.filter((h) => h.department).map((h) => h.department.toLowerCase()));
  console.log(`HOD logins (${hods.length}):`);
  for (const h of hods) console.log(`  ${h.username.padEnd(24)} ${h.department || 'NOT LINKED – sees no requests: link to an employee in User Management'}`);

  const others = withDept.filter((u) => u.role !== 'hod' && u.role !== 'admin');
  const noDept = others.filter((u) => !u.department);
  const noHod = others.filter((u) => u.department && !hodDepts.has(u.department.toLowerCase()));
  console.log(`\nOther logins: ${others.length}. Their leave reaches only Admin when:`);
  console.log(`  no employee / department (${noDept.length}): ${noDept.map((u) => u.username).join(', ') || '—'}`);
  console.log(`  no HOD in their department (${noHod.length}): ${noHod.map((u) => `${u.username} (${u.department})`).join(', ') || '—'}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
