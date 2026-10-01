// Fleet operations dashboard (G3): GET /api/ops/dashboard?operator=<employeeId>&tasks=mine|all
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const access = require('../../services/ops/accessScope');
const { dashboard } = require('../../services/ops/reports');
const { badRequest } = require('../../services/ops/voyageInput');
const { sendError } = require('./helpers');

router.get('/', async (req, res) => {
  try {
    const operator = req.query.operator || null;
    if (operator && !mongoose.isValidObjectId(operator)) throw badRequest('operator must be an employee id');
    const me = access.employeeIdOf(req.user);
    // "Tasks due today": an operator filter shows that operator's; otherwise the user's own, or everyone's
    // for people without tasks of their own (admin, managers without an employee link, directors) or on request
    let tasksFor = operator || null;
    if (!tasksFor && req.query.tasks !== 'all' && me && !access.seesAll(req.user)) tasksFor = me;
    if (!tasksFor && req.query.tasks === 'mine') tasksFor = me;
    const data = await dashboard({ voyageFilter: await access.voyageFilter(req.user), operator, tasksFor });
    res.json({ ...data, tasksScope: tasksFor ? (tasksFor === me ? 'mine' : 'operator') : 'all', canFilterOperator: access.seesAll(req.user), myEmployeeId: me });
  } catch (err) { sendError(res, err, 'Error loading the dashboard'); }
});

module.exports = router;
