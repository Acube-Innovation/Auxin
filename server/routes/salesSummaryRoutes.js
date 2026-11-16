// Sales Summary page: the daily Sales & Leads summaries (jobs/salesSummary.js) a login has received.
// Each login sees only its own summaries: an admin's covers all staff, a HOD's the people they approve.
const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const OpsEmailLog = require('../models/ops/OpsEmailLog');
const Employee = require('../models/Employee');
const { canView } = require('../jobs/salesSummary');

const router = express.Router();
router.use(authMiddleware);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function scope(user) {
  const emails = [user.emailId];
  if (user.employeeId) {
    const e = await Employee.findById(user.employeeId).select('emailId').lean();
    if (e) emails.push(e.emailId);
  }
  const list = [...new Set(emails.filter(Boolean).map((e) => e.trim()))];
  const or = [{ toUser: user._id }];
  // Summaries stored before toUser existed: by address
  if (list.length) or.push({ toUser: null, to: { $in: list.map((e) => new RegExp(`^${esc(e)}$`, 'i')) } });
  return { kind: 'SALES_SUMMARY', $or: or };
}

router.get('/access', async (req, res) => {
  try {
    res.json({ canView: await canView(req.user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const items = await OpsEmailLog.find(await scope(req.user)).select('at to toName subject status').sort({ at: -1 }).limit(90).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Summary not found' });
    const doc = await OpsEmailLog.findOne({ ...(await scope(req.user)), _id: req.params.id }).lean();
    if (!doc) return res.status(404).json({ message: 'Summary not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
