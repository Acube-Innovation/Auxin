// Ops Reports (features H1–H3): /api/ops/reports/*. Filtered, not paginated (the data is exported).
// Every row respects the user's voyage access; times are returned as UTC instants with their zone so the
// client can write local-time and UTC columns.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const VoyageTask = require('../../models/ops/VoyageTask');
const DateRevision = require('../../models/ops/DateRevision');
const access = require('../../services/ops/accessScope');
const engine = require('../../services/ops/dueDateEngine');
const { badRequest } = require('../../services/ops/voyageInput');
const { sendError } = require('./helpers');

const MAX_ROWS = 20000;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const idOf = (v) => (v ? String(v._id || v) : null);

// Voyages the user may see, narrowed by the common filters (voyage, vessel, operator, status)
async function visibleVoyages(req, { includeDrafts = false } = {}) {
  const and = [await access.voyageFilter(req.user)];
  const q = req.query;
  for (const [key, field] of [['voyage', '_id'], ['vessel', 'vessel'], ['operator', 'operators']]) {
    if (!q[key]) continue;
    const ids = String(q[key]).split(',').filter(Boolean);
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw badRequest(`${key} must be an id`);
    and.push({ [field]: { $in: ids } });
  }
  if (q.voyageStatus) and.push({ status: { $in: String(q.voyageStatus).split(',') } });
  else if (!includeDrafts) and.push({ status: { $ne: 'DRAFT' } });
  return Voyage.find({ $and: and }).populate('vessel', 'name').populate('operators', 'employeeName').sort({ voyageNo: 1 }).lean();
}

const voyageCols = (v) => ({ voyageId: v._id, voyageNo: v.voyageNo, vessel: v.vessel ? v.vessel.name : '', voyageStatus: v.status });

// ---------------------------------------------------------------- H1: voyage task status
router.get('/tasks', async (req, res) => {
  try {
    const voyages = await visibleVoyages(req, { includeDrafts: true });
    const byId = new Map(voyages.map((v) => [String(v._id), v]));
    const filter = { voyage: { $in: [...byId.keys()] } };
    if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
    if (req.query.assignee) filter.assignedTo = req.query.assignee;
    const today = engine.todayIn();
    const tasks = await VoyageTask.find(filter).select('-history -reminderSent')
      .populate('stage', 'name order').populate({ path: 'portCall', select: 'seq type port', populate: { path: 'port', select: 'name' } })
      .populate('assignedTo', 'employeeName').sort({ voyage: 1, sortKey: 1 }).limit(MAX_ROWS).lean();
    const rows = tasks.map((t) => {
      const d = engine.derive(t, today);
      return {
        ...voyageCols(byId.get(idOf(t.voyage))),
        taskId: t._id, code: t.code, task: t.baseName || t.name, stage: t.stage ? t.stage.name : 'Ad-hoc', port: t.portCall && t.portCall.port ? t.portCall.port.name : '',
        rule: t.anchor && t.anchor.event ? { event: t.anchor.event, offsetDays: t.offsetDays, recurrence: t.recurrence } : null,
        dueDate: t.dueDate, dueSetByHand: Boolean(t.dueOverridden), startDate: t.startDate, completedDate: t.completedDate,
        status: t.status, bucket: d.bucket, overdueDays: d.overdueDays, pendingDays: d.pendingDays, dueInDays: d.dueInDays,
        priority: t.priority, assignedTo: (t.assignedTo || []).map((a) => a.employeeName).join(', '),
        remarks: t.remarks || '', naReason: t.naReason || '', attachments: (t.attachments || []).length,
      };
    });
    res.json({ today, voyages: voyages.map(voyageCols), rows, truncated: tasks.length === MAX_ROWS });
  } catch (err) { sendError(res, err, 'Error building the task status report'); }
});

// ---------------------------------------------------------------- H2: overdue and on-time
// Tasks due in [from, to] (default: the last 30 days up to today), grouped as on time / late / overdue / open.
router.get('/overdue', async (req, res) => {
  try {
    const today = engine.todayIn();
    const to = req.query.to || today;
    const from = req.query.from || DateTime.fromISO(to).minus({ days: 30 }).toISODate();
    if (!isDate(from) || !isDate(to) || from > to) throw badRequest('from / to must be dates (YYYY-MM-DD), from ≤ to');
    const voyages = await visibleVoyages(req);
    const byId = new Map(voyages.map((v) => [String(v._id), v]));
    const filter = { voyage: { $in: [...byId.keys()] }, status: { $ne: 'NA' }, dueDate: { $gte: from, $lte: to } };
    if (req.query.assignee) {
      if (!mongoose.isValidObjectId(req.query.assignee)) throw badRequest('assignee must be an id');
      filter.assignedTo = req.query.assignee;
    }
    if (req.query.priority) filter.priority = req.query.priority;
    const tasks = await VoyageTask.find(filter).select('voyage code name baseName dueDate completedDate status priority assignedTo stage portCall')
      .populate('assignedTo', 'employeeName').populate('stage', 'name').populate({ path: 'portCall', select: 'port', populate: { path: 'port', select: 'name' } })
      .sort({ dueDate: 1 }).limit(MAX_ROWS).lean();

    const outcomeOf = (t, d) => {
      if (t.status === 'DONE') return d.overdueDays === 0 ? 'ON_TIME' : 'LATE';
      return t.dueDate < today ? 'OVERDUE' : 'OPEN';
    };
    const blank = () => ({ ON_TIME: 0, LATE: 0, OVERDUE: 0, OPEN: 0, total: 0 });
    const totals = blank();
    const perOperator = new Map();
    const perVoyage = new Map();
    const rows = tasks.map((t) => {
      const d = engine.derive(t, today);
      const outcome = outcomeOf(t, d);
      const people = (t.assignedTo || []).map((a) => a.employeeName);
      totals[outcome]++; totals.total++;
      for (const name of people.length ? people : ['(unassigned)']) {
        if (!perOperator.has(name)) perOperator.set(name, blank());
        perOperator.get(name)[outcome]++; perOperator.get(name).total++;
      }
      const v = byId.get(idOf(t.voyage));
      if (!perVoyage.has(v.voyageNo)) perVoyage.set(v.voyageNo, { ...voyageCols(v), ...blank() });
      perVoyage.get(v.voyageNo)[outcome]++; perVoyage.get(v.voyageNo).total++;
      return {
        ...voyageCols(v), taskId: t._id, code: t.code, task: t.baseName || t.name, stage: t.stage ? t.stage.name : 'Ad-hoc',
        port: t.portCall && t.portCall.port ? t.portCall.port.name : '', dueDate: t.dueDate, completedDate: t.completedDate,
        status: t.status, outcome, daysLate: d.overdueDays, priority: t.priority, assignedTo: people.join(', '),
      };
    });
    const pct = (s) => (s.ON_TIME + s.LATE ? Math.round((s.ON_TIME / (s.ON_TIME + s.LATE)) * 1000) / 10 : null);
    res.json({
      today, from, to,
      totals: { ...totals, onTimePct: pct(totals) },
      byOperator: [...perOperator].map(([name, s]) => ({ operator: name, ...s, onTimePct: pct(s) })).sort((a, b) => a.operator.localeCompare(b.operator)),
      byVoyage: [...perVoyage.values()].map((s) => ({ ...s, onTimePct: pct(s) })),
      rows,
      truncated: tasks.length === MAX_ROWS,
    });
  } catch (err) { sendError(res, err, 'Error building the overdue / on-time report'); }
});

// ---------------------------------------------------------------- H3: planned vs actual port report
// Every port call of the selected voyages; optional ETA window from / to (office dates)
router.get('/port-calls', async (req, res) => {
  try {
    const voyages = await visibleVoyages(req);
    const byId = new Map(voyages.map((v) => [String(v._id), v]));
    const filter = { voyage: { $in: [...byId.keys()] } };
    if (!req.query.includeCancelled) filter.status = { $ne: 'CANCELLED' };
    const calls = await PortCall.find(filter).populate('port', 'name country unlocode').populate('agent', 'companyName').sort({ voyage: 1, seq: 1 }).lean();
    const revisions = await DateRevision.aggregate([
      { $match: { portCall: { $in: calls.map((c) => c._id) } } },
      { $group: { _id: { portCall: '$portCall', field: '$field' }, n: { $sum: 1 } } },
    ]);
    const revCount = new Map(revisions.map((r) => [`${r._id.portCall}:${r._id.field}`, r.n]));
    const hours = (a, b) => (a && b ? Math.round(((new Date(b) - new Date(a)) / 3600000) * 10) / 10 : null);
    const { from, to } = req.query;
    if ((from && !isDate(from)) || (to && !isDate(to))) throw badRequest('from / to must be dates (YYYY-MM-DD)');
    const inWindow = (pc) => {
      if (!from && !to) return true;
      const at = pc.actual?.ata || pc.planned?.eta; // arrival: actual if known, else planned
      if (!at) return false;
      const d = DateTime.fromJSDate(new Date(at)).setZone(pc.timeZone).toISODate();
      return (!from || d >= from) && (!to || d <= to);
    };
    const rows = calls.filter(inWindow).map((pc) => {
      const pair = (label, p, a) => ({
        [`${label}Original`]: pc.original?.[p] || null, [`${label}Planned`]: pc.planned?.[p] || null, [`${label}Actual`]: pc.actual?.[a] || null,
        [`${label}DelayH`]: hours(pc.original?.[p] || pc.planned?.[p], pc.actual?.[a]),
      });
      return {
        ...voyageCols(byId.get(idOf(pc.voyage))), portCallId: pc._id, seq: pc.seq, port: pc.port ? pc.port.name : '', unlocode: pc.port?.unlocode || '',
        type: pc.type, status: pc.status, timeZone: pc.timeZone, agent: pc.agent ? pc.agent.companyName : '',
        cargoQty: pc.cargoQty ?? null, ratePerDay: pc.ratePerDay ?? null,
        ...pair('arrival', 'eta', 'ata'), ...pair('berthing', 'etb', 'atb'), ...pair('completion', 'etc', 'completed'), ...pair('sailing', 'ets', 'atd'),
        norTendered: pc.actual?.norTendered || null, pob: pc.actual?.pob || null, commenced: pc.actual?.commenced || null,
        etaRevisions: revCount.get(`${pc._id}:planned.eta`) || 0,
        portStayH: hours(pc.actual?.ata, pc.actual?.atd),
      };
    });
    res.json({ rows });
  } catch (err) { sendError(res, err, 'Error building the port report'); }
});

module.exports = router;
