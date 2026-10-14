/**
 * Department scope for leave approval: an HOD sees and approves only the leave of people in their own department.
 *
 * A login's department is the department of its Employee record: the one linked by User.employeeId, otherwise the
 * Employee with the same email address. LeaveRequest.employee is a User id (requests made by the employee) or an
 * Employee id (requests an admin made for an employee), so both kinds of id are matched.
 */
const User = require('../models/User');
const Employee = require('../models/Employee');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameText = (s) => new RegExp(`^${escapeRegex(String(s).trim())}$`, 'i');
const cleanDepartment = (d) => (d && String(d).trim()) || null;

async function employeeOfUser(user) {
    if (!user) return null;
    if (user.employeeId) {
        const linked = await Employee.findById(user.employeeId).select('department').lean();
        if (linked) return linked;
    }
    if (user.emailId && String(user.emailId).trim()) {
        return Employee.findOne({ emailId: sameText(user.emailId) }).select('department').lean();
    }
    return null;
}

/** Department of a login user (document or id); null when the login has no employee record with a department */
async function departmentOfUser(userOrId) {
    const user = userOrId && userOrId._id
        ? userOrId
        : await User.findById(userOrId).select('employeeId emailId').lean();
    const employee = await employeeOfUser(user);
    return cleanDepartment(employee && employee.department);
}

/** Department of the person a leave request belongs to (User id or Employee id) */
async function departmentOfLeaveEmployee(id) {
    if (!id) return null;
    const user = await User.findById(id).select('employeeId emailId').lean();
    if (user) return departmentOfUser(user);
    const employee = await Employee.findById(id).select('department').lean();
    return cleanDepartment(employee && employee.department);
}

/** Every id (User and Employee) a leave request of someone in the department can carry */
async function leaveEmployeeIdsInDepartment(department) {
    if (!cleanDepartment(department)) return [];
    const employees = await Employee.find({ department: sameText(department) }).select('_id emailId').lean();
    if (!employees.length) return [];
    const employeeIds = employees.map((e) => String(e._id));
    const emails = employees.map((e) => e.emailId).filter(Boolean).map(sameText);
    const candidates = await User.find({
        $or: [{ employeeId: { $in: employeeIds } }, ...(emails.length ? [{ emailId: { $in: emails } }] : [])],
    }).select('_id employeeId emailId').lean();

    // A login matched only by email belongs here unless its employeeId links it to another existing employee
    const otherLinks = candidates
        .filter((u) => u.employeeId && !employeeIds.includes(String(u.employeeId)))
        .map((u) => u.employeeId);
    const existingOther = new Set(
        (await Employee.find({ _id: { $in: otherLinks } }).select('_id').lean()).map((e) => String(e._id))
    );
    const userIds = candidates
        .filter((u) => !u.employeeId || employeeIds.includes(String(u.employeeId)) || !existingOther.has(String(u.employeeId)))
        .map((u) => String(u._id));

    return [...userIds, ...employeeIds];
}

/** HOD logins of a department */
async function hodsOfDepartment(department) {
    if (!cleanDepartment(department)) return [];
    const hods = await User.find({ role: 'hod' }).select('username emailId employeeId role').lean();
    const out = [];
    for (const hod of hods) {
        const d = await departmentOfUser(hod);
        if (d && d.toLowerCase() === cleanDepartment(department).toLowerCase()) out.push(hod);
    }
    return out;
}

module.exports = { departmentOfUser, departmentOfLeaveEmployee, leaveEmployeeIdsInDepartment, hodsOfDepartment };
