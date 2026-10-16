// User Management → Leave Approvers: for each person, the HOD and HR logins that approve their leave (Admin only)
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const LeaveApprover = require('../models/LeaveApprover');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { employeeOfUser } = require('../utils/leaveScope');
const { present } = require('../utils/leaveApproverView');

router.use(authMiddleware, requireRole(['admin']));

const badRequest = (res, message) => res.status(400).json({ message });
const isId = (v) => v && mongoose.isValidObjectId(v);
const userFields = 'username emailId role employeeId';

// The rows, with each person's department and warnings
router.get('/', async (req, res) => {
    try {
        const rows = await LeaveApprover.find().lean();
        const out = await present(rows);
        out.sort((a, b) => a.name.localeCompare(b.name));
        res.json(out);
    } catch (e) {
        res.status(500).json({ message: 'Error loading leave approvers', error: e.message });
    }
});

// Choices for the form: people (employees, then logins without an employee record) and logins for HOD / HR
router.get('/options', async (req, res) => {
    try {
        const [employees, users, rows] = await Promise.all([
            Employee.find().select('employeeId employeeName department emailId').sort({ employeeName: 1 }).lean(),
            User.find().select(userFields).sort({ username: 1 }).lean(),
            LeaveApprover.find().select('employee user').lean(),
        ]);
        const linked = new Set();
        for (const u of users) {
            const e = await employeeOfUser(u);
            if (e) linked.add(String(u._id));
        }
        const taken = new Map(rows.flatMap((r) => [r.employee && [`e:${r.employee}`, String(r._id)], r.user && [`u:${r.user}`, String(r._id)]].filter(Boolean)));
        res.json({
            people: [
                ...employees.map((e) => ({ key: `e:${e._id}`, kind: 'employee', id: e._id, label: `${e.employeeName}${e.employeeId ? ` (${e.employeeId})` : ''}`, department: e.department || '', mappingId: taken.get(`e:${e._id}`) || null })),
                ...users.filter((u) => !linked.has(String(u._id))).map((u) => ({ key: `u:${u._id}`, kind: 'user', id: u._id, label: `${u.username} (login only)`, department: '', mappingId: taken.get(`u:${u._id}`) || null })),
            ],
            logins: users.map((u) => ({ _id: u._id, username: u.username, role: u.role })),
        });
    } catch (e) {
        res.status(500).json({ message: 'Error loading options', error: e.message });
    }
});

// body: { person: 'e:<employeeId>' | 'u:<userId>', hod: userId | null, hr: userId | null }
async function readBody(body) {
    const { person, hod, hr } = body || {};
    const m = /^(e|u):([0-9a-f]{24})$/i.exec(String(person || ''));
    if (!m) return { error: 'Choose the employee' };
    const out = { employee: null, user: null, hod: null, hr: null };
    if (m[1] === 'e') {
        if (!(await Employee.exists({ _id: m[2] }))) return { error: 'That employee no longer exists' };
        out.employee = m[2];
    } else {
        if (!(await User.exists({ _id: m[2] }))) return { error: 'That login no longer exists' };
        out.user = m[2];
    }
    if (!hod && !hr) return { error: 'Choose an HOD or an HR (or both)' };
    for (const [k, v] of [['hod', hod], ['hr', hr]]) {
        if (!v) continue;
        if (!isId(v) || !(await User.exists({ _id: v }))) return { error: `That ${k.toUpperCase()} login no longer exists` };
        out[k] = v;
    }
    return { data: out };
}

router.post('/', async (req, res) => {
    try {
        const { data, error } = await readBody(req.body);
        if (error) return badRequest(res, error);
        const clash = await LeaveApprover.findOne(data.employee ? { employee: data.employee } : { user: data.user }).lean();
        if (clash) return res.status(409).json({ message: 'This employee already has leave approvers. Edit that row instead.' });
        const row = await LeaveApprover.create({ ...data, updatedBy: req.user._id });
        res.status(201).json((await present([row.toObject()]))[0]);
    } catch (e) {
        res.status(500).json({ message: 'Error saving leave approvers', error: e.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!isId(req.params.id)) return badRequest(res, 'Invalid id');
        const row = await LeaveApprover.findById(req.params.id);
        if (!row) return res.status(404).json({ message: 'Row not found' });
        const { data, error } = await readBody(req.body);
        if (error) return badRequest(res, error);
        const clash = await LeaveApprover.findOne({ _id: { $ne: row._id }, ...(data.employee ? { employee: data.employee } : { user: data.user }) }).lean();
        if (clash) return res.status(409).json({ message: 'This employee already has another leave approvers row.' });
        Object.assign(row, data, { updatedBy: req.user._id });
        await row.save();
        res.json((await present([row.toObject()]))[0]);
    } catch (e) {
        res.status(500).json({ message: 'Error saving leave approvers', error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!isId(req.params.id)) return badRequest(res, 'Invalid id');
        const row = await LeaveApprover.findByIdAndDelete(req.params.id);
        if (!row) return res.status(404).json({ message: 'Row not found' });
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Error deleting leave approvers', error: e.message });
    }
});

module.exports = router;
