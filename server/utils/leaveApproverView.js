// Leave Approvers rows as shown in User Management and by scripts/checkLeaveApprovers.js
const Employee = require('../models/Employee');
const User = require('../models/User');

const userFields = 'username emailId role employeeId';

/** Rows with the person (employee and own login), department, HOD, HR and warnings about gaps */
async function present(rows) {
    const userIds = new Set();
    const employeeIds = new Set();
    rows.forEach((r) => {
        ['user', 'hod', 'hr'].forEach((k) => r[k] && userIds.add(String(r[k])));
        if (r.employee) employeeIds.add(String(r.employee));
    });
    const users = new Map((await User.find({ _id: { $in: [...userIds] } }).select(userFields).lean()).map((u) => [String(u._id), u]));
    const employees = new Map((await Employee.find({ _id: { $in: [...employeeIds] } }).select('employeeId employeeName department emailId').lean()).map((e) => [String(e._id), e]));
    const pick = (u) => (u ? { _id: u._id, username: u.username, role: u.role, emailId: u.emailId } : null);
    const out = [];
    for (const r of rows) {
        const employee = r.employee ? employees.get(String(r.employee)) || null : null;
        // The person's own logins: needed to apply for leave, and they cannot approve their own requests
        let logins = r.user && users.get(String(r.user)) ? [users.get(String(r.user))] : [];
        if (!logins.length && employee) {
            const byEmail = employee.emailId ? [{ emailId: new RegExp(`^${String(employee.emailId).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] : [];
            logins = await User.find({ $or: [{ employeeId: employee._id }, ...byEmail] }).select(userFields).lean();
        }
        const login = logins[0] || null;
        const isSelf = (u) => u && logins.some((l) => String(l._id) === String(u._id));
        const hod = r.hod ? users.get(String(r.hod)) || null : null;
        const hr = r.hr ? users.get(String(r.hr)) || null : null;
        const warnings = [];
        if (r.employee && !employee) warnings.push('Employee record no longer exists');
        if (r.user && !users.get(String(r.user))) warnings.push('Login no longer exists');
        if (!login) warnings.push('No login – this person cannot apply for leave themselves');
        if (!r.hod) warnings.push('No HOD – requests go straight to HR');
        if (!r.hr) warnings.push('No HR – Admin gives the final approval');
        if (r.hod && !hod) warnings.push('HOD login no longer exists');
        if (r.hr && !hr) warnings.push('HR login no longer exists');
        if (isSelf(hod)) warnings.push('HOD is this person – Admin must approve their HOD step');
        if (isSelf(hr)) warnings.push('HR is this person – Admin must give their final approval');
        out.push({
            _id: r._id,
            employee: employee ? { _id: employee._id, employeeId: employee.employeeId, employeeName: employee.employeeName, emailId: employee.emailId } : null,
            user: pick(login),
            logins: logins.map((l) => l.username),
            name: (employee && employee.employeeName) || (login && login.username) || '(removed)',
            department: (employee && employee.department) || '',
            hod: pick(hod),
            hr: pick(hr),
            warnings,
            updatedAt: r.updatedAt,
        });
    }
    return out;
}

module.exports = { present };
