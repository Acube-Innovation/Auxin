const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { hasOfficialHolidayOnStartOrEnd, calculateWorkingDays } = require('../utils/leaveUtils');
const Employee = require('../models/Employee');
const { personOfLeaveEmployee, approversOfLeave, approverScope, ownLeaveIds, approvalStep } = require('../utils/leaveScope');
const Notification = require('../models/Notification');
const { smtpReason } = require('../utils/smtpReason');

/**
 * Map a leave type string to the corresponding leaveOverride field key.
 */
function leaveTypeToOverrideField(leaveType) {
    if (!leaveType) return 'otherLeave';
    const t = leaveType.toLowerCase();
    if (t === 'sick leave') return 'sickLeave';
    if (t === 'privilege leave') return 'privilegeLeave';
    if (t === 'casual leave') return 'casualLeave';
    return 'otherLeave';
}

/**
 * Restore leave balance to Employee leaveOverride when a leave is rejected/deleted.
 * Only applies if admin has set a manual override balance on that employee.
 * The dynamic balance (non-override) is self-correcting since Rejected/deleted
 * leaves are excluded from the Pending/HOD Approved/Approved status filter.
 */
async function restoreLeaveBalance(leaveRequest) {
    try {
        if (!leaveRequest || !leaveRequest.employee) return;
        const employeeUserId = typeof leaveRequest.employee === 'object'
            ? leaveRequest.employee._id || leaveRequest.employee
            : leaveRequest.employee;

        const user = await User.findById(employeeUserId).select('emailId').lean();
        if (!user || !user.emailId) return;

        const escapedEmail = user.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') });
        if (!employeeRecord || !employeeRecord.leaveOverride) return;
        if (employeeRecord.leaveOverride.balance === null || employeeRecord.leaveOverride.balance === undefined) return;

        const daysToRestore = calculateWorkingDays(leaveRequest.startDate, leaveRequest.endDate);
        if (!daysToRestore || daysToRestore <= 0) return;

        employeeRecord.leaveOverride.balance += daysToRestore;
        if (
            employeeRecord.leaveOverride.totalTaken !== null &&
            employeeRecord.leaveOverride.totalTaken !== undefined
        ) {
            employeeRecord.leaveOverride.totalTaken = Math.max(0, employeeRecord.leaveOverride.totalTaken - daysToRestore);
        }

        // Also restore the per-type leave field if it has been overridden
        const typeField = leaveTypeToOverrideField(leaveRequest.leaveType);
        if (
            employeeRecord.leaveOverride[typeField] !== null &&
            employeeRecord.leaveOverride[typeField] !== undefined
        ) {
            employeeRecord.leaveOverride[typeField] = Math.max(0, employeeRecord.leaveOverride[typeField] - daysToRestore);
        }

        await employeeRecord.save();
        console.log(`[Leave] Restored ${daysToRestore} day(s) to override balance for employee ${user.emailId} (type: ${leaveRequest.leaveType})`);
    } catch (err) {
        console.error('[Leave] Failed to restore leave balance override:', err.message || err);
    }
}

/**
 * Deduct leave balance from Employee leaveOverride when a leave is approved.
 * Only applies when the employee has a manual override balance set.
 * The dynamic balance (non-override) is self-correcting since it counts all Approved leaves.
 */
async function deductLeaveBalance(leaveRequest) {
    try {
        if (!leaveRequest || !leaveRequest.employee) return;
        const employeeUserId = typeof leaveRequest.employee === 'object'
            ? leaveRequest.employee._id || leaveRequest.employee
            : leaveRequest.employee;

        const user = await User.findById(employeeUserId).select('emailId').lean();
        if (!user || !user.emailId) return;

        const escapedEmail = user.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') });
        if (!employeeRecord || !employeeRecord.leaveOverride) return;
        if (employeeRecord.leaveOverride.balance === null || employeeRecord.leaveOverride.balance === undefined) return;

        const daysToDeduct = calculateWorkingDays(leaveRequest.startDate, leaveRequest.endDate);
        if (!daysToDeduct || daysToDeduct <= 0) return;

        employeeRecord.leaveOverride.balance = Math.max(0, employeeRecord.leaveOverride.balance - daysToDeduct);
        if (employeeRecord.leaveOverride.totalTaken !== null && employeeRecord.leaveOverride.totalTaken !== undefined) {
            employeeRecord.leaveOverride.totalTaken += daysToDeduct;
        }

        const typeField = leaveTypeToOverrideField(leaveRequest.leaveType);
        if (employeeRecord.leaveOverride[typeField] !== null && employeeRecord.leaveOverride[typeField] !== undefined) {
            employeeRecord.leaveOverride[typeField] += daysToDeduct;
        }

        await employeeRecord.save();
        console.log(`[Leave] Deducted ${daysToDeduct} day(s) from override balance for employee ${user.emailId} (type: ${leaveRequest.leaveType}) on approval`);
    } catch (err) {
        console.error('[Leave] Failed to restore leave balance override:', err.message || err);
    }
}

function getLeaveTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Leave] EMAIL_USER or EMAIL_PASS not set in .env – cannot send leave emails');
        return null;
    }
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
    });
}

const fmtShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtLong = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

/**
 * Bell notification to one login, sent live when they are online (socket room user-<id>);
 * otherwise they get it from the Notification collection when they next open the app.
 */
async function notifyUser(io, user, { kind, leaveId, title, body }) {
    if (!user) return;
    const url = '/leave-requests';
    const payload = { id: `${kind}-${leaveId}:${user._id}`, type: kind, title, body, url, meta: { url, kind }, timestamp: new Date() };
    let online = false;
    if (io) {
        try { online = (await io.in(`user-${user._id}`).fetchSockets()).length > 0; } catch (e) { online = false; }
        if (online) io.to(`user-${user._id}`).emit('notification', payload);
    }
    await Notification.create({ title, body, payload, userId: user._id, deliveredTo: online ? [user._id] : [] });
}

/** Flow: Employee submits leave → bell to their HOD (to their HR when they have no HOD) */
async function notifyApproverOfNewLeave(io, leaveRequest, approver, step) {
    if (!approver) {
        console.warn(`[Leave] No HOD or HR set for "${leaveRequest.employeeName}" in Leave Approvers – only Admin can approve this request.`);
        return;
    }
    await notifyUser(io, approver, {
        kind: 'leave-request',
        leaveId: leaveRequest._id,
        title: `Leave request from ${leaveRequest.employeeName || 'an employee'}`,
        body: `${leaveRequest.leaveType || 'Leave'}, ${fmtShort(leaveRequest.startDate)} – ${fmtLong(leaveRequest.endDate)}. Waiting for your ${step === 'hr' ? 'HR' : 'HOD'} approval.`,
    });
}

/** Flow: HOD approves → bell to the employee's HR for the final approval */
async function notifyHrOfHodApproval(io, leaveRequest, hr, hodName) {
    if (!hr) {
        console.warn(`[Leave] No HR set for "${leaveRequest.employeeName}" in Leave Approvers – only Admin can give the final approval.`);
        return;
    }
    await notifyUser(io, hr, {
        kind: 'leave-hod-approved',
        leaveId: leaveRequest._id,
        title: `Leave approved by HOD: ${leaveRequest.employeeName || 'an employee'}`,
        body: `${leaveRequest.leaveType || 'Leave'}, ${fmtShort(leaveRequest.startDate)} – ${fmtLong(leaveRequest.endDate)}. Approved by ${hodName || 'HOD'}; waiting for your HR approval.`,
    });
}

/** Flow: HOD / HR / Admin decide → bell to the employee's own login */
async function notifyEmployeeOfStatus(io, leaveRequest, status) {
    const { user } = await personOfLeaveEmployee(leaveRequest.employee);
    if (!user) return;
    const text = status === 'HOD Approved' ? 'approved by HOD and is waiting for HR approval'
        : status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : `now ${status}`;
    await notifyUser(io, user, {
        kind: 'leave-status',
        leaveId: leaveRequest._id,
        title: `Leave request ${status === 'HOD Approved' ? 'approved by HOD' : status.toLowerCase()}`,
        body: `Your ${leaveRequest.leaveType || 'leave'} (${fmtShort(leaveRequest.startDate)} – ${fmtLong(leaveRequest.endDate)}) is ${text}.`,
    });
}

/** Flow: Employee submits leave → email to their HOD (or HR when they have no HOD) and to Admin. All emails FROM EMAIL_USER. */
async function sendLeaveRequestToHodAndAdmin(leaveRequest, hodUsers) {
    const transporter = getLeaveTransporter();
    if (!transporter) return;
    try {
        const adminUsers = await User.find({ role: 'admin' }, 'emailId username').lean();
        const toHod = hodUsers.map(u => (u.emailId && String(u.emailId).trim()) || null).filter(Boolean);
        const toAdmin = adminUsers.map(u => (u.emailId && String(u.emailId).trim()) || null).filter(Boolean);
        if (toHod.length === 0 && toAdmin.length === 0) {
            console.warn('[Leave] No approver or Admin with emailId. Set emailId for the HOD / HR in Leave Approvers and for users with role "admin".');
            return;
        }
        if (toAdmin.length === 0) {
            console.warn('[Leave] No Admin user with emailId. Add emailId for the user with role "admin" in User collection.');
        }
        const toList = [...new Set([...toHod, ...toAdmin])];
        console.log('[Leave] Sending new leave request – HOD:', toHod.length, 'recipient(s), Admin:', toAdmin.length, 'recipient(s). To:', toList.join(', '));
        const startStr = leaveRequest.startDate ? new Date(leaveRequest.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const endStr = leaveRequest.endDate ? new Date(leaveRequest.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const subject = `Leave Request from ${leaveRequest.employeeName || 'Employee'}`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #1a73e8;">New Leave Request</h2>
                <p><strong>Employee:</strong> ${leaveRequest.employeeName || 'N/A'}</p>
                <p><strong>Company:</strong> ${leaveRequest.company || 'N/A'}</p>
                <p><strong>Leave Type:</strong> ${leaveRequest.leaveType || 'N/A'}</p>
                <p><strong>Start Date:</strong> ${startStr}</p>
                <p><strong>End Date:</strong> ${endStr}</p>
                <p><strong>Reason:</strong> ${leaveRequest.reason || 'N/A'}</p>
                <p><strong>Applied On:</strong> ${leaveRequest.appliedOn ? new Date(leaveRequest.appliedOn).toLocaleString('en-IN') : 'N/A'}</p>
                <p style="margin-top: 20px; color: #555;">Please review and approve or reject in the leave request portal.</p>
            </div>
        `;
        for (const to of toList) {
            try {
                await transporter.sendMail({
                    from: `"Auxin Leave" <${process.env.EMAIL_USER}>`,
                    to,
                    subject,
                    html,
                });
                console.log('[Leave] Sent new leave request to HOD/Admin:', to);
            } catch (e) {
                console.error('[Leave] Failed to send new leave request to', to, '–', smtpReason(e));
            }
        }
    } catch (err) {
        console.error('[Leave] Failed to email HOD/Admin:', err);
    }
}

/** Flow: HOD approves → email to the employee's HR for the final approval. FROM EMAIL_USER. */
async function sendHodApprovedToHr(leaveRequest, hr, hodName) {
    const transporter = getLeaveTransporter();
    const to = hr && hr.emailId && String(hr.emailId).trim();
    if (!transporter || !to) return;
    try {
        await transporter.sendMail({
            from: `"Auxin Leave" <${process.env.EMAIL_USER}>`,
            to,
            subject: `Leave approved by HOD – ${leaveRequest.employeeName || 'Employee'} – waiting for HR approval`,
            html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #1a73e8;">Leave Request – Approved by HOD</h2>
                <p>${hodName || 'The HOD'} has approved this leave request. It now needs your HR approval.</p>
                <p><strong>Employee:</strong> ${leaveRequest.employeeName || 'N/A'}</p>
                <p><strong>Leave Type:</strong> ${leaveRequest.leaveType || 'N/A'}</p>
                <p><strong>Period:</strong> ${fmtLong(leaveRequest.startDate)} to ${fmtLong(leaveRequest.endDate)}</p>
                <p><strong>Reason:</strong> ${leaveRequest.reason || 'N/A'}</p>
                <p style="margin-top: 20px; color: #555;">Please review and approve or reject in the leave request portal.</p>
            </div>`,
        });
        console.log('[Leave] Sent HOD-approved request to HR:', to);
    } catch (err) {
        console.error('[Leave] Failed to email HR', to, '–', smtpReason(err));
    }
}

/** Flow: When HOD, HR or Admin approve/reject → email to employee. All emails FROM EMAIL_USER. */
async function sendLeaveStatusToEmployee(leaveRequest, newStatus) {
    const transporter = getLeaveTransporter();
    if (!transporter) return;
    try {
        let employeeEmail = null;
        const emp = leaveRequest.employee;
        if (emp && typeof emp === 'object' && emp.emailId) {
            employeeEmail = String(emp.emailId).trim() || null;
        }
        if (!employeeEmail && leaveRequest.employee) {
            const user = await User.findById(leaveRequest.employee).select('emailId').lean();
            employeeEmail = (user && user.emailId && String(user.emailId).trim()) || null;
        }
        if (!employeeEmail) {
            console.warn('[Leave] No employee email for leave request', leaveRequest._id);
            return;
        }
        const startStr = leaveRequest.startDate ? new Date(leaveRequest.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const endStr = leaveRequest.endDate ? new Date(leaveRequest.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        let statusLabel;
        let messageLine;
        if (newStatus === 'HOD Approved') {
            statusLabel = 'Approved by HOD';
            messageLine = 'Your leave request has been <strong>approved by HOD</strong> and is pending HR approval.';
        } else if (newStatus === 'Approved') {
            statusLabel = 'Approved';
            messageLine = 'Your leave request has been <strong>approved</strong>.';
        } else if (newStatus === 'Rejected') {
            statusLabel = 'Rejected';
            messageLine = 'Your leave request has been <strong>rejected</strong>.';
        } else {
            statusLabel = newStatus;
            messageLine = `Your leave request status: <strong>${newStatus}</strong>.`;
        }
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #1a73e8;">Leave Request – ${statusLabel}</h2>
                <p>${messageLine}</p>
                <p><strong>Leave Type:</strong> ${leaveRequest.leaveType || 'N/A'}</p>
                <p><strong>Period:</strong> ${startStr} to ${endStr}</p>
                <p><strong>Reason:</strong> ${leaveRequest.reason || 'N/A'}</p>
                <p style="margin-top: 20px; color: #555;">Thank you.</p>
            </div>
        `;
        await transporter.sendMail({
            from: `"Auxin Leave" <${process.env.EMAIL_USER}>`,
            to: employeeEmail,
            subject: `Leave Request – ${statusLabel}`,
            html,
        });
        console.log('[Leave] Sent status to employee:', employeeEmail);
    } catch (err) {
        console.error('[Leave] Failed to email employee –', smtpReason(err));
    }
}

// Get current user's leave balance (for frontend display)
router.get('/balance', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('emailId');

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
        const fyStartDate = new Date(fyStartYear, 3, 1);
        const fyEndDate = new Date(fyStartYear + 1, 2, 31);

        const entitlement = 21;
        const existingLeaves = await LeaveRequest.find({
            employee: userId,
            status: { $in: ['Approved', 'Pending', 'HOD Approved'] },
            startDate: { $gte: fyStartDate, $lte: fyEndDate }
        });

        let leaveDaysTaken = 0;
        for (const leave of existingLeaves) {
            leaveDaysTaken += calculateWorkingDays(leave.startDate, leave.endDate);
        }

        let finalLeaveBalance = Math.max(0, parseFloat((entitlement - leaveDaysTaken).toFixed(2)));
        let hasOverride = false;

        if (user && user.emailId) {
            const escapedEmail = user.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') }).select('leaveOverride');
            if (
                employeeRecord &&
                employeeRecord.leaveOverride &&
                employeeRecord.leaveOverride.balance !== null &&
                employeeRecord.leaveOverride.balance !== undefined
            ) {
                finalLeaveBalance = employeeRecord.leaveOverride.balance;
                hasOverride = true;
            }
        }

        res.json({
            balance: finalLeaveBalance,
            entitlement,
            leaveDaysTaken,
            hasOverride
        });
    } catch (error) {
        console.error('Error fetching leave balance:', error);
        res.status(500).json({ message: 'Error fetching leave balance', error: error.message });
    }
});

/**
 * Approvers and the step the current login may take, for each request:
 * approval = { hod, hr, step: 'hod' | 'hr' | 'admin' | null, own }. Rows are cached per employee id.
 */
async function withApproval(requests, user, rawEmployeeIds = new Map()) {
    const cache = new Map();
    const own = new Set(await ownLeaveIds(user));
    const isAdmin = user.role === 'admin';
    const out = [];
    for (const doc of requests) {
        const r = doc.toObject ? doc.toObject() : doc;
        // populate('employee') leaves null for requests Admin made with an Employee id, so use the stored id
        const key = rawEmployeeIds.get(String(r._id)) || idOf(r.employee);
        if (!cache.has(key)) cache.set(key, await approversOfLeave(key));
        const { hod, hr } = cache.get(key);
        const pick = (u) => (u ? { _id: u._id, username: u.username } : null);
        const step = isAdmin
            ? (['Pending', 'HOD Approved'].includes(r.status) ? 'admin' : null)
            : approvalStep({ status: r.status, hodId: idOf(hod), hrId: idOf(hr), userId: String(user._id), isOwn: own.has(key) });
        out.push({ ...r, approval: { hod: pick(hod), hr: pick(hr), step, own: own.has(key) } });
    }
    return out;
}

// Which leave requests the current user sees: all (admin), or their own plus those of the people they approve
router.get('/scope', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'admin') return res.json({ scope: 'all', hodOf: [], hrOf: [] });
        const { hodOf, hrOf } = await approverScope(req.user._id);
        const people = async (rows) => {
            const out = [];
            for (const m of rows) {
                const employee = m.employee ? await Employee.findById(m.employee).select('employeeName department').lean() : null;
                const user = m.user ? await User.findById(m.user).select('username').lean() : null;
                out.push({ employee: m.employee || null, user: m.user || null, name: (employee && employee.employeeName) || (user && user.username) || '', department: (employee && employee.department) || '' });
            }
            return out;
        };
        res.json({ scope: hodOf.length || hrOf.length ? 'approver' : 'own', hodOf: await people(hodOf), hrOf: await people(hrOf) });
    } catch (error) {
        console.error('Error fetching leave scope:', error);
        res.status(500).json({ message: 'Error fetching leave scope', error: error.message });
    }
});

// Get all leave requests
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, employeeId } = req.query;
        const filter = {};
        const statuses = ['Pending', 'HOD Approved', 'Approved', 'Rejected'];

        if (req.user.role === 'admin') {
            // Admin sees every request
            filter.status = status && status !== 'All' ? (statuses.includes(status) ? status : 'RESTRICTED_VIEW') : { $in: statuses };
            if (employeeId) filter.employee = employeeId;
        } else {
            // Everyone else: their own requests plus those of the people they are HOD or HR for (Leave Approvers)
            const { hodLeaveIds, hrLeaveIds } = await approverScope(req.user._id);
            const visible = new Set([...(await ownLeaveIds(req.user)), ...hodLeaveIds, ...hrLeaveIds]);
            filter.employee = employeeId ? (visible.has(String(employeeId)) ? employeeId : { $in: [] }) : { $in: [...visible] };
            if (status && status !== 'All') filter.status = status;
        }

        const leaveRequests = await LeaveRequest.find(filter)
            .populate('employee', 'username emailId')
            .populate('hodApprovedBy', 'username')
            .populate('hrApprovedBy', 'username')
            .populate('rejectedBy', 'username')
            .populate('adminApprovedBy', 'username')
            .sort({ appliedOn: -1 });

        const raw = await LeaveRequest.find({ _id: { $in: leaveRequests.map((r) => r._id) } }).select('employee').lean();
        res.json(await withApproval(leaveRequests, req.user, new Map(raw.map((r) => [String(r._id), idOf(r.employee)]))));
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Error fetching leave requests', error: error.message });
    }
});

// Create a new leave request
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { employeeId, employeeName, company, leaveType, startDate, endDate, reason } = req.body;

        if (hasOfficialHolidayOnStartOrEnd(startDate, endDate)) {
            return res.status(400).json({ message: 'This is a government holiday. You should not apply for a leave request.' });
        }

        // Calculate leave days requested
        const reqStartDate = new Date(startDate);
        const reqEndDate = new Date(endDate);
        const requestedDays = calculateWorkingDays(reqStartDate, reqEndDate);

        // Always use the logged-in user's ID for balance lookup
        // (employeeId from admin forms may be an Employee._id, not a User._id)
        const balanceUserId = req.user.id;
        const user = await User.findById(balanceUserId).select('emailId');

        let finalLeaveBalance = 21; // default full entitlement if lookup fails
        let employeeRecord = null;
        let hasOverride = false;

        // Dynamic balance calculation (financial year: April–March)
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
        const fyStartDate = new Date(fyStartYear, 3, 1);
        const fyEndDate = new Date(fyStartYear + 1, 2, 31);

        const entitlement = 21;
        const existingLeaves = await LeaveRequest.find({
            employee: balanceUserId,
            status: { $in: ['Approved', 'Pending', 'HOD Approved'] },
            startDate: { $gte: fyStartDate, $lte: fyEndDate }
        });

        let leaveDaysTaken = 0;
        for (const leave of existingLeaves) {
            leaveDaysTaken += calculateWorkingDays(leave.startDate, leave.endDate);
        }

        finalLeaveBalance = Math.max(0, parseFloat((entitlement - leaveDaysTaken).toFixed(2)));

        // Check for admin override balance on Employee record
        if (user && user.emailId) {
            const escapedEmail = user.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') });
            if (
                employeeRecord &&
                employeeRecord.leaveOverride &&
                employeeRecord.leaveOverride.balance !== null &&
                employeeRecord.leaveOverride.balance !== undefined
            ) {
                finalLeaveBalance = employeeRecord.leaveOverride.balance;
                hasOverride = true;
            }
        }

        if (requestedDays > finalLeaveBalance) {
            return res.status(400).json({
                message: `Insufficient leave balance. You requested ${requestedDays} day(s), but only have ${finalLeaveBalance} day(s) available.`
            });
        }

        // Deduct from override balance if admin has set one
        if (hasOverride && employeeRecord) {
            employeeRecord.leaveOverride.balance -= requestedDays;
            if (
                employeeRecord.leaveOverride.totalTaken !== null &&
                employeeRecord.leaveOverride.totalTaken !== undefined
            ) {
                employeeRecord.leaveOverride.totalTaken += requestedDays;
            }

            // Also update the per-type leave field if it has been overridden
            const typeField = leaveTypeToOverrideField(leaveType);
            if (
                employeeRecord.leaveOverride[typeField] !== null &&
                employeeRecord.leaveOverride[typeField] !== undefined
            ) {
                employeeRecord.leaveOverride[typeField] += requestedDays;
            }

            await employeeRecord.save();
        };

        const newLeaveRequest = new LeaveRequest({
            employee: employeeId || req.user.id,
            employeeName: employeeName || req.user.username,
            company,
            leaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            status: 'Pending'
        });

        const savedRequest = await newLeaveRequest.save();
        res.status(201).json(savedRequest);

        const leaveSnapshot = {
            employeeName: savedRequest.employeeName,
            company: savedRequest.company,
            leaveType: savedRequest.leaveType,
            startDate: savedRequest.startDate,
            endDate: savedRequest.endDate,
            reason: savedRequest.reason,
            appliedOn: savedRequest.appliedOn,
        };
        // First approver: the HOD named for this person in Leave Approvers, or their HR when no HOD is set
        (async () => {
            const { hod, hr } = await approversOfLeave(savedRequest.employee);
            const approver = hod || hr;
            await notifyApproverOfNewLeave(req.app.get('io'), { ...leaveSnapshot, _id: savedRequest._id }, approver, hod ? 'hod' : 'hr');
            await sendLeaveRequestToHodAndAdmin(leaveSnapshot, approver ? [approver] : []);
        })()
            .catch(e => console.error('[Leave] Approver notification / approver-Admin email error:', e));
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(400).json({ message: 'Error creating leave request', error: error.message });
    }
});


// Update leave request status (Admin/HOD) or edit request (Employee)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { employeeId, employeeName, company, status, leaveType, startDate, endDate, reason } = req.body;
        const updateData = {};

        const oldRequest = await LeaveRequest.findById(req.params.id);
        if (!oldRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        // Approval: Admin may set any status; others only take their own step for this person (Leave Approvers):
        // HOD: Pending → HOD Approved, HR: HOD Approved → Approved (or Pending → Approved when no HOD is set).
        let approvers = null;
        if (status) {
            if (req.user.role === 'admin') {
                const allowedStatuses = ['Pending', 'HOD Approved', 'Approved', 'Rejected'];
                if (!allowedStatuses.includes(status)) {
                    return res.status(400).json({ message: 'Invalid status value' });
                }
                updateData.status = status;
                if (status === 'Approved' || status === 'Rejected') {
                    updateData.adminApprovedBy = req.user.id;
                    updateData.adminApprovedAt = new Date();
                }
                if (status === 'Rejected') {
                    updateData.rejectedBy = req.user.id;
                    updateData.rejectedAt = new Date();
                }
            } else if (status !== oldRequest.status) {
                if (!['Approved', 'HOD Approved', 'Rejected'].includes(status)) {
                    return res.status(400).json({ message: 'Invalid status value' });
                }
                approvers = await approversOfLeave(oldRequest.employee);
                const isOwn = (await ownLeaveIds(req.user)).includes(String(oldRequest.employee));
                const step = approvalStep({ status: oldRequest.status, hodId: idOf(approvers.hod), hrId: idOf(approvers.hr), userId: String(req.user._id), isOwn });
                if (!step) {
                    const reason = isOwn ? 'You cannot approve or reject your own leave request.'
                        : oldRequest.status === 'Pending' ? 'Only the HOD set for this employee in Leave Approvers can act on this request now.'
                        : oldRequest.status === 'HOD Approved' ? 'Only the HR set for this employee in Leave Approvers can give the final approval.'
                        : `This request is already ${oldRequest.status}.`;
                    return res.status(403).json({ message: reason });
                }
                const now = new Date();
                if (status === 'Rejected') {
                    updateData.status = 'Rejected';
                    updateData.rejectedBy = req.user.id;
                    updateData.rejectedAt = now;
                } else if (step === 'hod') {
                    updateData.status = 'HOD Approved';
                    updateData.hodApprovedBy = req.user.id;
                    updateData.hodApprovedAt = now;
                } else {
                    updateData.status = 'Approved';
                    updateData.hrApprovedBy = req.user.id;
                    updateData.hrApprovedAt = now;
                }
            }
        }
        // An approver's decision changes the status only, never the request's details
        const decisionOnly = !!approvers;

        // Handle other field updates (for employee editing their own request)
        if (!decisionOnly) {
            if (employeeId) updateData.employee = employeeId;
            if (employeeName) updateData.employeeName = employeeName;
            if (company) updateData.company = company;
            if (leaveType) updateData.leaveType = leaveType;
            if (startDate) updateData.startDate = new Date(startDate);
            if (endDate) updateData.endDate = new Date(endDate);
            if (reason) updateData.reason = reason;
        }

        const effectiveStart = updateData.startDate || oldRequest.startDate;
        const effectiveEnd = updateData.endDate || oldRequest.endDate;
        const startStr = effectiveStart && (effectiveStart.toISOString ? effectiveStart.toISOString().split('T')[0] : effectiveStart);
        const endStr = effectiveEnd && (effectiveEnd.toISOString ? effectiveEnd.toISOString().split('T')[0] : effectiveEnd);
        if (startStr && endStr && hasOfficialHolidayOnStartOrEnd(startStr, endStr)) {
            return res.status(400).json({ message: 'This is a government holiday. You should not apply for a leave request.' });
        }

        // Balance validation for employees editing their own pending requests with date changes
        const isEmployee = req.user.role !== 'admin' && !decisionOnly;
        const datesChanged = (startDate || endDate) && oldRequest.status === 'Pending';
        if (isEmployee && datesChanged) {
            const newDays = calculateWorkingDays(effectiveStart, effectiveEnd);
            const oldDays = calculateWorkingDays(oldRequest.startDate, oldRequest.endDate);
            const extraDays = newDays - oldDays;

            if (extraDays > 0) {
                // Need to check if employee has enough balance for the additional days
                const balanceUserId = req.user.id;
                const balanceUser = await User.findById(balanceUserId).select('emailId');

                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
                const fyStartDate = new Date(fyStartYear, 3, 1);
                const fyEndDate = new Date(fyStartYear + 1, 2, 31);

                const entitlement = 21;
                // Fetch all active leaves EXCLUDING this request (since we're replacing it)
                const existingLeaves = await LeaveRequest.find({
                    employee: balanceUserId,
                    _id: { $ne: oldRequest._id },
                    status: { $in: ['Approved', 'Pending', 'HOD Approved'] },
                    startDate: { $gte: fyStartDate, $lte: fyEndDate }
                });

                let leaveDaysTaken = 0;
                for (const leave of existingLeaves) {
                    leaveDaysTaken += calculateWorkingDays(leave.startDate, leave.endDate);
                }

                let availableBalance = Math.max(0, parseFloat((entitlement - leaveDaysTaken).toFixed(2)));

                // Check for admin override balance
                if (balanceUser && balanceUser.emailId) {
                    const escapedEmail = balanceUser.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') }).select('leaveOverride');
                    if (
                        employeeRecord &&
                        employeeRecord.leaveOverride &&
                        employeeRecord.leaveOverride.balance !== null &&
                        employeeRecord.leaveOverride.balance !== undefined
                    ) {
                        // Override balance already had old days deducted; add them back then use as ceiling
                        availableBalance = employeeRecord.leaveOverride.balance + oldDays;
                    }
                }

                if (newDays > availableBalance) {
                    return res.status(400).json({
                        message: `Insufficient leave balance. You requested ${newDays} day(s), but only have ${availableBalance} day(s) available.`
                    });
                }

                // Update override balance to reflect the new day count difference
                if (balanceUser && balanceUser.emailId) {
                    const escapedEmail = balanceUser.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') });
                    if (
                        employeeRecord &&
                        employeeRecord.leaveOverride &&
                        employeeRecord.leaveOverride.balance !== null &&
                        employeeRecord.leaveOverride.balance !== undefined
                    ) {
                        employeeRecord.leaveOverride.balance -= extraDays;
                        if (employeeRecord.leaveOverride.totalTaken !== null && employeeRecord.leaveOverride.totalTaken !== undefined) {
                            employeeRecord.leaveOverride.totalTaken += extraDays;
                        }
                        const typeField = leaveTypeToOverrideField(leaveType || oldRequest.leaveType);
                        if (employeeRecord.leaveOverride[typeField] !== null && employeeRecord.leaveOverride[typeField] !== undefined) {
                            employeeRecord.leaveOverride[typeField] += extraDays;
                        }
                        await employeeRecord.save();
                    }
                }
            } else if (extraDays < 0) {
                // Employee shortened the leave — restore the freed-up days to override balance
                const daysToRestore = Math.abs(extraDays);
                const balanceUser = await User.findById(req.user.id).select('emailId');
                if (balanceUser && balanceUser.emailId) {
                    const escapedEmail = balanceUser.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') });
                    if (
                        employeeRecord &&
                        employeeRecord.leaveOverride &&
                        employeeRecord.leaveOverride.balance !== null &&
                        employeeRecord.leaveOverride.balance !== undefined
                    ) {
                        employeeRecord.leaveOverride.balance += daysToRestore;
                        if (employeeRecord.leaveOverride.totalTaken !== null && employeeRecord.leaveOverride.totalTaken !== undefined) {
                            employeeRecord.leaveOverride.totalTaken = Math.max(0, employeeRecord.leaveOverride.totalTaken - daysToRestore);
                        }
                        const typeField = leaveTypeToOverrideField(leaveType || oldRequest.leaveType);
                        if (employeeRecord.leaveOverride[typeField] !== null && employeeRecord.leaveOverride[typeField] !== undefined) {
                            employeeRecord.leaveOverride[typeField] = Math.max(0, employeeRecord.leaveOverride[typeField] - daysToRestore);
                        }
                        await employeeRecord.save();
                    }
                }
            }
        }

        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('employee', 'username emailId')
            .populate('hodApprovedBy', 'username')
            .populate('hrApprovedBy', 'username')
            .populate('rejectedBy', 'username')
            .populate('adminApprovedBy', 'username');

        // If the leave was just rejected, restore the balance back to the employee's override
        const wasActiveLeave = ['Pending', 'HOD Approved', 'Approved'].includes(oldRequest.status);
        if (updateData.status === 'Rejected' && wasActiveLeave) {
            restoreLeaveBalance(oldRequest)
                .catch(e => console.error('[Leave] Balance restore error on reject:', e));
        }

        // If the leave is being approved for the first time (Pending → Approved, or HOD Approved → Approved),
        // deduct the days from the override balance.
        // NOTE: When employees submit via POST, balance is deducted there. But when admin directly
        // approves without going through the normal submission (e.g. admin-created leave),
        // we need to deduct here to keep the override in sync.
        const wasNotYetApproved = ['Pending', 'HOD Approved'].includes(oldRequest.status);
        if (updateData.status === 'Approved' && wasNotYetApproved) {
            deductLeaveBalance(oldRequest)
                .catch(e => console.error('[Leave] Balance deduction error on approve:', e));
        }

        if (updateData.status && updateData.status !== oldRequest.status && ['HOD Approved', 'Approved', 'Rejected'].includes(updateData.status)) {
            sendLeaveStatusToEmployee(updatedRequest, updateData.status)
                .catch(e => console.error('[Leave] Employee status email error:', e));
            const io = req.app.get('io');
            const leaveForNotice = { _id: oldRequest._id, employee: oldRequest.employee, employeeName: updatedRequest.employeeName, leaveType: updatedRequest.leaveType, startDate: updatedRequest.startDate, endDate: updatedRequest.endDate, reason: updatedRequest.reason };
            (async () => {
                await notifyEmployeeOfStatus(io, leaveForNotice, updateData.status);
                // HOD approved → the employee's HR gives the final approval
                if (updateData.status === 'HOD Approved') {
                    const { hr } = approvers || await approversOfLeave(oldRequest.employee);
                    await notifyHrOfHodApproval(io, leaveForNotice, hr, req.user.username);
                    await sendHodApprovedToHr(leaveForNotice, hr, req.user.username);
                }
            })().catch(e => console.error('[Leave] Status notification error:', e));
        }

        res.json(updatedRequest);
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(400).json({ message: 'Error updating leave request', error: error.message });
    }
});

// Delete leave request
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const deletedRequest = await LeaveRequest.findByIdAndDelete(req.params.id);
        if (!deletedRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        // If the deleted leave was still active (Pending / HOD Approved), restore balance
        const wasActive = ['Pending', 'HOD Approved'].includes(deletedRequest.status);
        if (wasActive) {
            restoreLeaveBalance(deletedRequest)
                .catch(e => console.error('[Leave] Balance restore error on delete:', e));
        }

        res.json({ message: 'Leave request deleted successfully' });
    } catch (error) {
        console.error('Error deleting leave request:', error);
        res.status(500).json({ message: 'Error deleting leave request', error: error.message });
    }
});

module.exports = router;
