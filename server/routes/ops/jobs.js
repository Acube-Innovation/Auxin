// Scheduled jobs and the email log (features F1–F6), admin only: /api/ops/jobs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const OpsEmailLog = require('../../models/ops/OpsEmailLog');
const scheduler = require('../../jobs/ops/scheduler');
const mailer = require('../../utils/mailer');
const cfg = require('../../services/ops/config');
const { sendError, httpError, escapeRegex } = require('./helpers');

router.get('/', async (req, res) => {
  try {
    res.json({
      jobs: await scheduler.list(),
      officeTimeZone: cfg.OFFICE_TZ,
      emailConfigured: mailer.isConfigured(),
      schedulerEnabled: cfg.JOBS_ENABLED,
      settings: {
        reminderTime: cfg.REMINDER_TIME, digestTime: cfg.DIGEST_TIME, escalationTime: cfg.ESCALATION_TIME,
        escalateHighDays: cfg.ESCALATE_HIGH_DAYS, escalateOtherDays: cfg.ESCALATE_OTHER_DAYS, escalationRoles: cfg.ESCALATION_ROLES,
      },
    });
  } catch (err) { sendError(res, err, 'Error fetching jobs'); }
});

router.post('/:name/run', async (req, res) => {
  try {
    res.json(await scheduler.runNow(req.params.name));
  } catch (err) { sendError(res, err, 'Error running job'); }
});

router.get('/emails', async (req, res) => {
  try {
    const filter = {};
    if (req.query.kind) filter.kind = req.query.kind;
    if (req.query.to) filter.to = new RegExp(escapeRegex(req.query.to), 'i');
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    res.json(await OpsEmailLog.find(filter).select('-html').sort({ at: -1 }).limit(limit).lean());
  } catch (err) { sendError(res, err, 'Error fetching emails'); }
});

router.get('/emails/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Email not found');
    const doc = await OpsEmailLog.findById(req.params.id).lean();
    if (!doc) throw httpError(404, 'Email not found');
    res.json(doc);
  } catch (err) { sendError(res, err, 'Error fetching email'); }
});

module.exports = router;
