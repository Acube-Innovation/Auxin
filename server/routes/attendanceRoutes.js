const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

function toStartOfDay(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { employeeId, date, status, note } = req.body;
    if (!employeeId || !date || !status) return res.status(400).json({ message: 'employeeId, date and status are required' });
    if (!['Onsite', 'Leave'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const day = toStartOfDay(date);
    const update = { employee: employeeId, date: day, status, note: note || '', updatedBy: req.user?._id };
    const record = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: day },
      update,
      { upsert: true, new: true, runValidators: true }
    );

    // Sync with Employee model
    console.log(`[Attendance] Syncing Employee ${employeeId} status to ${status}`);
    const updatedEmp = await Employee.findByIdAndUpdate(employeeId, { attendance: status }, { new: true });
    console.log(`[Attendance] Employee ${employeeId} updated. New status: ${updatedEmp?.attendance}`);

    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, note } = req.body;
    const update = {};
    if (status) update.status = status;
    if (note !== undefined) update.note = note;
    update.updatedBy = req.user?._id;
    const record = await Attendance.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    const filter = { employee: req.params.employeeId };
    if (start && end) {
      filter.date = { $gte: toStartOfDay(start), $lte: toStartOfDay(end) };
    }
    const records = await Attendance.find(filter).sort({ date: -1 });
    res.json(records);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/range', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: 'start and end are required' });
    const s = toStartOfDay(start);
    const e = toStartOfDay(end);
    e.setHours(23, 59, 59, 999);
    // Populate employee details so the frontend can display names
    const records = await Attendance.find({ date: { $gte: s, $lte: e } })
      .sort({ date: -1 })
      .populate('employee', 'employeeName department role');
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/summary/monthly', authMiddleware, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    if (!year) return res.status(400).json({ message: 'year is required' });
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    const pipeline = [
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: { m: { $month: '$date' }, s: '$status' }, count: { $sum: 1 } } },
      { $group: { _id: '$_id.m', byStatus: { $push: { status: '$_id.s', count: '$count' } } } },
      { $sort: { _id: 1 } }
    ];
    const agg = await Attendance.aggregate(pipeline);
    res.json(agg);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/summary/yearly', authMiddleware, async (req, res) => {
  try {
    const pipeline = [
      { $group: { _id: { y: { $year: '$date' }, s: '$status' }, count: { $sum: 1 } } },
      { $group: { _id: '$_id.y', byStatus: { $push: { status: '$_id.s', count: '$count' } } } },
      { $sort: { _id: 1 } }
    ];
    const agg = await Attendance.aggregate(pipeline);
    res.json(agg);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;