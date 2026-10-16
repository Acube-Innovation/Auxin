/**
 * Who a leave request belongs to, and who approves it (User Management → Leave Approvers).
 *
 * A leave request's `employee` is a User id (the person applied from their own login) or an Employee id
 * (Admin applied for them). A person is an Employee record, found from a login by User.employeeId or
 * else by the same email address; people without an Employee record are their login only.
 * Each person has one LeaveApprover row naming their HOD and HR logins.
 */
const User = require('../models/User');
const Employee = require('../models/Employee');
const LeaveApprover = require('../models/LeaveApprover');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameText = (s) => new RegExp(`^${escapeRegex(String(s).trim())}$`, 'i');
const id = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

/** Employee record of a login (linked by employeeId, otherwise same email), or null */
async function employeeOfUser(user) {
    if (!user) return null;
    if (user.employeeId) {
        const linked = await Employee.findById(user.employeeId).select('employeeName employeeId department emailId').lean();
        if (linked) return linked;
    }
    if (user.emailId && String(user.emailId).trim()) {
        return Employee.findOne({ emailId: sameText(user.emailId) }).select('employeeName employeeId department emailId').lean();
    }
    return null;
}

/** The person a leave request belongs to: { user, employee } (either may be null) */
async function personOfLeaveEmployee(leaveEmployeeId) {
    if (!leaveEmployeeId) return { user: null, employee: null };
    const user = await User.findById(id(leaveEmployeeId)).select('username emailId employeeId role').lean();
    if (user) return { user, employee: await employeeOfUser(user) };
    const employee = await Employee.findById(id(leaveEmployeeId)).select('employeeName employeeId department emailId').lean();
    return { user: null, employee };
}

/** Leave Approvers row of a person: the row of their login first, then the row of their Employee record */
async function mappingOfPerson({ user, employee }) {
    if (user) {
        const byUser = await LeaveApprover.findOne({ user: user._id }).lean();
        if (byUser) return byUser;
    }
    if (employee) return LeaveApprover.findOne({ employee: employee._id }).lean();
    return null;
}

/** { person, mapping, hod, hr } for a leave request's employee id; hod / hr are logins or null */
async function approversOfLeave(leaveEmployeeId) {
    const person = await personOfLeaveEmployee(leaveEmployeeId);
    const mapping = await mappingOfPerson(person);
    const load = (userId) => (userId ? User.findById(userId).select('username emailId role').lean() : null);
    return { person, mapping, hod: mapping ? await load(mapping.hod) : null, hr: mapping ? await load(mapping.hr) : null };
}

/** Every id (User and Employee) a leave request of these employees can carry */
async function leaveIdsOfEmployees(employeeIds) {
    const ids = employeeIds.map(String);
    if (!ids.length) return [];
    const employees = await Employee.find({ _id: { $in: ids } }).select('_id emailId').lean();
    const emails = employees.map((e) => e.emailId).filter((e) => e && String(e).trim()).map(sameText);
    const candidates = await User.find({
        $or: [{ employeeId: { $in: ids } }, ...(emails.length ? [{ emailId: { $in: emails } }] : [])],
    }).select('_id employeeId').lean();
    // A login matched only by email belongs here unless its employeeId links it to another existing employee
    const otherLinks = candidates.filter((u) => u.employeeId && !ids.includes(String(u.employeeId))).map((u) => u.employeeId);
    const existingOther = new Set((await Employee.find({ _id: { $in: otherLinks } }).select('_id').lean()).map((e) => String(e._id)));
    const userIds = candidates
        .filter((u) => !u.employeeId || ids.includes(String(u.employeeId)) || !existingOther.has(String(u.employeeId)))
        .map((u) => String(u._id));
    return [...userIds, ...ids];
}

/** Every leave employee id covered by these Leave Approvers rows */
async function leaveIdsOfMappings(mappings) {
    const out = new Set(mappings.filter((m) => m.user).map((m) => String(m.user)));
    (await leaveIdsOfEmployees(mappings.filter((m) => m.employee).map((m) => m.employee))).forEach((x) => out.add(x));
    return out;
}

/** What a login approves: { hodOf, hrOf } rows and the leave employee ids they cover */
async function approverScope(userId) {
    const [hodOf, hrOf] = await Promise.all([
        LeaveApprover.find({ hod: userId }).lean(),
        LeaveApprover.find({ hr: userId }).lean(),
    ]);
    return { hodOf, hrOf, hodLeaveIds: await leaveIdsOfMappings(hodOf), hrLeaveIds: await leaveIdsOfMappings(hrOf) };
}

/** Ids a login's own leave requests carry: the login and its Employee record */
async function ownLeaveIds(user) {
    const employee = await employeeOfUser(user);
    return [String(user._id), ...(employee ? [String(employee._id)] : [])];
}

/**
 * The step a login may take on a request now: 'hod' (Pending → HOD Approved), 'hr' (HOD Approved → Approved,
 * or Pending → Approved when the person has no HOD), or null. Nobody acts on their own leave.
 */
function approvalStep({ status, hodId, hrId, userId, isOwn }) {
    if (isOwn) return null;
    if (status === 'Pending' && hodId && hodId === userId) return 'hod';
    if (status === 'Pending' && !hodId && hrId && hrId === userId) return 'hr';
    if (status === 'HOD Approved' && hrId && hrId === userId) return 'hr';
    return null;
}

module.exports = { employeeOfUser, personOfLeaveEmployee, approversOfLeave, leaveIdsOfEmployees, approverScope, ownLeaveIds, approvalStep };
