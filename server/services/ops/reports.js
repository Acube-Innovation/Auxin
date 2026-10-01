// Report View (G2) and fleet dashboard (G3). Every count comes from engine.derive(), the helper the
// Operations View uses, so the numbers on all screens agree (acceptance scenario, scope §13).
const { DateTime } = require('luxon');
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const VoyageTask = require('../../models/ops/VoyageTask');
const DailyCheckLog = require('../../models/ops/DailyCheckLog');
const engine = require('./dueDateEngine');
const { OFFICE_TZ } = require('./config');

const OPEN = ['NOT_STARTED', 'INITIATED', 'AWAITING'];
const STATUSES = ['NOT_STARTED', 'INITIATED', 'AWAITING', 'DONE'];
const idOf = (v) => (v ? String(v._id || v) : null);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const effectiveStatus = (v) => (v.vesselStatusOverride && v.vesselStatusOverride.value) || v.vesselStatus;

// ---------------------------------------------------------------- Report View (G2)
async function voyageReport(voyageId) {
  const voyage = await Voyage.findById(voyageId).populate('vessel', 'name').lean();
  const today = engine.todayIn();
  const [tasks, portCalls] = await Promise.all([
    VoyageTask.find({ voyage: voyage._id }).select('-history -reminderSent -attachments')
      .populate('stage', 'name code order').populate({ path: 'portCall', select: 'seq type port status', populate: { path: 'port', select: 'name' } })
      .populate('assignedTo', 'employeeName').sort({ sortKey: 1 }).lean(),
    PortCall.find({ voyage: voyage._id }).populate('port', 'name').sort({ seq: 1 }).lean(),
  ]);
  const rows = tasks.map((t) => ({ ...t, ...engine.derive(t, today) }));
  const counted = rows.filter((t) => t.status !== 'NA'); // N/A tasks are left out of every count (scope 6.4)

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, counted.filter((t) => t.status === s).length]));
  const byBucket = {};
  for (const t of rows) byBucket[t.bucket] = (byBucket[t.bucket] || 0) + 1; // same as the Operations View chips
  const done = counted.filter((t) => t.status === 'DONE');
  const doneWithDue = done.filter((t) => t.dueDate);
  const onTime = doneWithDue.filter((t) => t.onTime).length;

  // Progress per stage (and port for port-call stages), in task order
  const groups = new Map();
  for (const t of counted) {
    const key = `${idOf(t.stage) || 'adhoc'}:${idOf(t.portCall) || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        stage: t.stage ? t.stage.name : 'Ad-hoc tasks',
        order: t.stage ? t.stage.order : 999,
        port: t.portCall && t.portCall.port ? t.portCall.port.name : null,
        total: 0, done: 0, overdue: 0, open: 0,
      });
    }
    const g = groups.get(key);
    g.total++;
    if (t.status === 'DONE') g.done++;
    else g.open++;
    if (t.bucket === 'OVERDUE') g.overdue++;
  }
  const byStage = [...groups.values()].map((g) => ({ ...g, pctComplete: pct(g.done, g.total) }));

  const overdue = counted.filter((t) => t.bucket === 'OVERDUE')
    .sort((a, b) => b.overdueDays - a.overdueDays || a.sortKey - b.sortKey)
    .map((t) => ({
      _id: t._id, code: t.code, name: t.baseName || t.name, stage: t.stage ? t.stage.name : null,
      port: t.portCall && t.portCall.port ? t.portCall.port.name : null, dueDate: t.dueDate, overdueDays: t.overdueDays,
      status: t.status, priority: t.priority, assignedTo: (t.assignedTo || []).map((a) => a.employeeName),
    }));

  // Planned vs actual port timeline (original plan = frozen at activation, C3/C4)
  const minutes = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null);
  const portTimeline = [
    { kind: 'DELIVERY', name: `Delivery${voyage.delivery?.place ? ` — ${voyage.delivery.place}` : ''}`, timeZone: voyage.delivery?.timeZone || OFFICE_TZ,
      events: [{ key: 'delivery', label: 'Delivery', original: voyage.delivery?.original || null, planned: voyage.delivery?.estimated || null, actual: voyage.delivery?.actual || null }] },
    ...portCalls.map((pc) => ({
      kind: pc.type, name: pc.port ? pc.port.name : '?', seq: pc.seq, status: pc.status, timeZone: pc.timeZone, portCallId: pc._id,
      events: [
        ['arrival', 'Arrival', 'eta', 'ata'], ['berthing', 'Berthing', 'etb', 'atb'],
        ['completion', 'Completion', 'etc', 'completed'], ['sailing', 'Sailing', 'ets', 'atd'],
      ].map(([key, label, p, a]) => ({ key, label, original: pc.original?.[p] || null, planned: pc.planned?.[p] || null, actual: pc.actual?.[a] || null })),
    })),
    { kind: 'REDELIVERY', name: `Re-delivery${voyage.redelivery?.place ? ` — ${voyage.redelivery.place}` : ''}`, timeZone: voyage.redelivery?.timeZone || OFFICE_TZ,
      events: [{ key: 'redelivery', label: 'Re-delivery', original: voyage.redelivery?.original || null, planned: voyage.redelivery?.estimated || null, actual: voyage.redelivery?.actual || null }] },
  ].map((row) => ({
    ...row,
    events: row.events.map((e) => ({ ...e, delayMinutes: minutes(e.original || e.planned, e.actual), planChangeMinutes: minutes(e.original, e.planned) })),
  }));

  return {
    today,
    voyage: { _id: voyage._id, voyageNo: voyage.voyageNo, vessel: voyage.vessel?.name, status: voyage.status, vesselStatus: effectiveStatus(voyage) },
    totals: {
      tasks: rows.length,
      counted: counted.length,
      notApplicable: rows.length - counted.length,
      done: done.length,
      open: counted.length - done.length,
      overdue: byBucket.OVERDUE || 0,
      pctComplete: pct(done.length, counted.length),
      onTime,
      late: doneWithDue.length - onTime,
      onTimePct: pct(onTime, doneWithDue.length),
    },
    byStatus,
    byBucket,
    byStage,
    overdue,
    portTimeline,
  };
}

// ---------------------------------------------------------------- Fleet dashboard (G3)
// voyageFilter: the access filter of the user; operator: employee id (managers' filter);
// tasksFor: employee id whose tasks due today are listed (null = all on the listed voyages)
async function dashboard({ voyageFilter, operator = null, tasksFor = null }) {
  const today = engine.todayIn();
  const in7 = DateTime.fromISO(today).plus({ days: 7 }).toISODate();
  // $and so that the operator filter can never widen the user's own access filter
  const filter = { $and: [voyageFilter, { status: 'ACTIVE' }, ...(operator ? [{ operators: operator }] : [])] };
  const voyages = await Voyage.find(filter).populate('vessel', 'name').populate('operators', 'employeeName').sort({ voyageNo: 1 }).lean();
  const ids = voyages.map((v) => v._id);
  const [tasks, portCalls, logs] = await Promise.all([
    VoyageTask.find({ voyage: { $in: ids }, status: { $in: OPEN } })
      .select('voyage name baseName code dueDate status priority assignedTo startDate completedDate portCall stage linkedField sortKey')
      .populate('assignedTo', 'employeeName').populate({ path: 'portCall', select: 'port', populate: { path: 'port', select: 'name' } }).lean(),
    PortCall.find({ voyage: { $in: ids }, status: { $ne: 'CANCELLED' } }).populate('port', 'name').sort({ seq: 1 }).lean(),
    DailyCheckLog.find({ voyage: { $in: ids }, date: today }).select('voyage items.done').lean(),
  ]);

  const counts = new Map(ids.map((id) => [String(id), { overdue: 0, today: 0, next7: 0, awaitingDate: 0, open: 0 }]));
  const derived = tasks.map((t) => ({ ...t, ...engine.derive(t, today) }));
  for (const t of derived) {
    const c = counts.get(idOf(t.voyage));
    c.open++;
    if (t.bucket === 'OVERDUE') c.overdue++;
    else if (t.bucket === 'TODAY') c.today++;
    else if (t.bucket === 'AWAITING_DATE') c.awaitingDate++;
    if (t.dueDate && t.dueDate > today && t.dueDate <= in7) c.next7++;
  }
  const checks = new Map(logs.map((l) => [idOf(l.voyage), { done: l.items.filter((i) => i.done).length, total: l.items.length }]));

  const cards = voyages.map((v) => {
    const calls = portCalls.filter((pc) => idOf(pc.voyage) === idOf(v));
    const inPort = calls.filter((pc) => (pc.actual?.ata || pc.actual?.atb) && !pc.actual?.atd).pop();
    const next = calls.find((pc) => !pc.actual?.ata && !pc.actual?.atb && !pc.actual?.atd);
    const call = (pc, mode) => (pc ? {
      portCallId: pc._id, port: pc.port?.name, type: pc.type, timeZone: pc.timeZone, mode,
      eta: pc.planned?.eta || null, etb: pc.planned?.etb || null, ets: pc.planned?.ets || null, ata: pc.actual?.ata || null,
    } : null);
    return {
      _id: v._id, voyageNo: v.voyageNo, vessel: v.vessel?.name, vesselStatus: effectiveStatus(v),
      vesselStatusManual: Boolean(v.vesselStatusOverride && v.vesselStatusOverride.value),
      operators: (v.operators || []).map((o) => o.employeeName),
      currentPort: call(inPort, 'IN_PORT'),
      nextPort: call(next, 'NEXT'),
      redelivery: !next ? { at: v.redelivery?.estimated || null, timeZone: v.redelivery?.timeZone || OFFICE_TZ, place: v.redelivery?.place || null } : null,
      counts: counts.get(String(v._id)),
      checks: checks.get(String(v._id)) || null,
    };
  });

  const due = derived.filter((t) => t.bucket === 'TODAY' && (!tasksFor || (t.assignedTo || []).some((a) => idOf(a) === String(tasksFor))));
  const byId = new Map(voyages.map((v) => [String(v._id), v]));
  const tasksToday = due.sort((a, b) => byId.get(idOf(a.voyage)).voyageNo.localeCompare(byId.get(idOf(b.voyage)).voyageNo) || a.sortKey - b.sortKey)
    .map((t) => ({ ...t, voyage: { _id: t.voyage, voyageNo: byId.get(idOf(t.voyage)).voyageNo, vessel: byId.get(idOf(t.voyage)).vessel?.name } }));

  const sum = (k) => cards.reduce((n, c) => n + c.counts[k], 0);
  return {
    today,
    kpis: { activeVoyages: cards.length, overdue: sum('overdue'), dueToday: sum('today'), next7: sum('next7'), awaitingDate: sum('awaitingDate') },
    voyages: cards,
    tasksToday,
  };
}

module.exports = { voyageReport, dashboard };
