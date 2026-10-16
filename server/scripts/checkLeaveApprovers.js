// Read-only check of Leave Approvers: each person's HOD and HR, problems in the rows, and who has no row
// (their leave requests reach Admin only). Changes nothing.
// Usage (in the server folder): node scripts/checkLeaveApprovers.js
require('dotenv').config();
const mongoose = require('mongoose');
const LeaveApprover = require('../models/LeaveApprover');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { employeeOfUser } = require('../utils/leaveScope');
const { present } = require('../utils/leaveApproverView');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const rows = await present(await LeaveApprover.find().lean());
  rows.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Leave Approvers rows: ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.name}${r.department ? ` (${r.department})` : ''}  →  HOD: ${r.hod ? r.hod.username : '-'}  |  HR: ${r.hr ? r.hr.username : '-'}`);
    r.warnings.forEach((w) => console.log(`      ! ${w}`));
  }

  // People without a row: employees, then logins that have no employee record
  const mapped = await LeaveApprover.find().select('employee user').lean();
  const mappedEmployees = new Set(mapped.filter((m) => m.employee).map((m) => String(m.employee)));
  const mappedUsers = new Set(mapped.filter((m) => m.user).map((m) => String(m.user)));
  const employees = await Employee.find().select('employeeName department').sort({ employeeName: 1 }).lean();
  const missing = employees.filter((e) => !mappedEmployees.has(String(e._id))).map((e) => `${e.employeeName}${e.department ? ` (${e.department})` : ''}`);
  for (const u of await User.find().select('username emailId employeeId role').sort({ username: 1 }).lean()) {
    if (!(await employeeOfUser(u)) && !mappedUsers.has(String(u._id))) missing.push(`${u.username} (login only, ${u.role})`);
  }
  console.log(`\nWithout a row – their leave reaches Admin only (${missing.length}):`);
  missing.forEach((m) => console.log(`  ${m}`));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
