// Due-date engine (Development Scope 5.1–5.2, 5.6). Pure functions: no database access.
//
//   due date = calendar date of the key date, in the zone it belongs to, + offset days
//
// "Calendar date in local time" deliberately replaces the Excel ROUND(date, 0), which moved the date
// forward when the key time was 12:00 or later (e.g. Kochi ETA 13-Jul 12:00 − 2 days = 11-Jul, not 12-Jul).
const { DateTime } = require('luxon');
const { OFFICE_TZ } = require('./config');

const idOf = (v) => (v ? String(v._id || v) : null);

// Pick actual / estimate according to the basis
function pick(actual, estimate, basis) {
  if (basis === 'ACTUAL') return actual || null;
  if (basis === 'ESTIMATE') return estimate || null;
  return actual || estimate || null; // BEST
}

// The bunkering port call of a voyage (explicit link, else the first active bunkering call)
function bunkerCallOf(voyage, portCalls) {
  const linked = idOf(voyage.bunker && voyage.bunker.portCall);
  const calls = (portCalls || []).filter((pc) => pc.status !== 'CANCELLED');
  return calls.find((pc) => idOf(pc) === linked) || calls.find((pc) => pc.type === 'BUNKERING') || null;
}

// Resolve a key date to { at: Date|null, zone } for a task. portCall is the task's own port call (or null).
function resolveAnchor(event, basis, voyage, portCall, portCalls) {
  const b = basis || 'BEST';
  const f = voyage.fixture || {};
  const d = voyage.delivery || {};
  const r = voyage.redelivery || {};
  const pc = portCall || null;
  switch (event) {
    case 'CARGO_FIXED': return { at: f.cargoFixedAt || null, zone: OFFICE_TZ };
    case 'VESSEL_FIXED': return { at: f.vesselFixedAt || null, zone: OFFICE_TZ };
    case 'DELIVERY': return { at: pick(d.actual, d.estimated, b), zone: d.timeZone || OFFICE_TZ };
    case 'REDELIVERY': return { at: pick(r.actual, r.estimated, b), zone: r.timeZone || OFFICE_TZ };
    case 'BUNKER_BOOKED': return { at: (voyage.bunker && voyage.bunker.bookedOn) || null, zone: OFFICE_TZ };
    case 'BUNKERING_DATE': {
      // The task's own bunkering call if it has one, else the voyage's bunkering call
      const call = pc && pc.type === 'BUNKERING' ? pc : bunkerCallOf(voyage, portCalls);
      const isVoyageCall = call && idOf(call) === idOf(bunkerCallOf(voyage, portCalls));
      const zone = (call && call.timeZone) || OFFICE_TZ;
      if (isVoyageCall && voyage.bunker && voyage.bunker.bunkeringDate) return { at: voyage.bunker.bunkeringDate, zone };
      if (!call) return { at: (voyage.bunker && voyage.bunker.bunkeringDate) || null, zone };
      const a = call.actual || {};
      const p = call.planned || {};
      // Scope: bunkering date, else berthing (ATB ?? ETB); arrival as a last resort when no berthing time is known
      return { at: pick(a.atb, p.etb, b) || pick(a.ata, p.eta, b), zone };
    }
    case 'ARRIVAL': return pc ? { at: pick(pc.actual && pc.actual.ata, pc.planned && pc.planned.eta, b), zone: pc.timeZone } : { at: null, zone: OFFICE_TZ };
    case 'BERTHING': return pc ? { at: pick(pc.actual && pc.actual.atb, pc.planned && pc.planned.etb, b), zone: pc.timeZone } : { at: null, zone: OFFICE_TZ };
    case 'OPS_COMPLETED': return pc ? { at: pick(pc.actual && pc.actual.completed, pc.planned && pc.planned.etc, b), zone: pc.timeZone } : { at: null, zone: OFFICE_TZ };
    case 'SAILING': {
      if (!pc) return { at: null, zone: OFFICE_TZ };
      const a = pc.actual || {};
      const p = pc.planned || {};
      return { at: pick(a.atd, p.ets || p.etc, b), zone: pc.timeZone };
    }
    default: return { at: null, zone: OFFICE_TZ };
  }
}

// Calendar date ('YYYY-MM-DD') of an instant in a zone, plus whole days
function computeDueDate(at, zone, offsetDays) {
  if (!at) return null;
  return DateTime.fromJSDate(new Date(at), { zone: zone || OFFICE_TZ }).startOf('day').plus({ days: Number(offsetDays || 0) }).toISODate();
}

// Due date of a task (or template applied to a port call). recurrenceIndex k adds k × everyDays.
// Returns null when the key date is unknown, or when a recurring instance falls after its end date.
function dueDateFor(rule, voyage, portCall, portCalls, recurrenceIndex = null) {
  const anchor = resolveAnchor(rule.anchor && rule.anchor.event, rule.anchor && rule.anchor.basis, voyage, portCall, portCalls);
  const first = computeDueDate(anchor.at, anchor.zone, rule.offsetDays);
  if (!first) return null;
  const every = rule.recurrence && rule.recurrence.everyDays;
  if (!every || !recurrenceIndex) return first;
  const due = DateTime.fromISO(first).plus({ days: recurrenceIndex * every }).toISODate();
  const end = recurrenceEnd(rule, voyage, portCall, portCalls);
  return end && due > end ? null : due;
}

// Last allowed date of a recurring rule (calendar date of the "until" event), or null if open-ended / unknown
function recurrenceEnd(rule, voyage, portCall, portCalls) {
  const until = rule.recurrence && rule.recurrence.until;
  if (!until) return null;
  const a = resolveAnchor(until, 'BEST', voyage, portCall, portCalls);
  return computeDueDate(a.at, a.zone, 0);
}

// All due dates of a recurring rule (first instance and the repeats up to the end date), max `limit`
function recurringDueDates(rule, voyage, portCall, portCalls, limit = 60) {
  const first = dueDateFor(rule, voyage, portCall, portCalls, 0);
  if (!first) return [];
  const every = rule.recurrence && rule.recurrence.everyDays;
  if (!every) return [first];
  const end = recurrenceEnd(rule, voyage, portCall, portCalls);
  const out = [];
  for (let k = 0; k < limit; k++) {
    const d = DateTime.fromISO(first).plus({ days: k * every }).toISODate();
    if (end && d > end) break;
    out.push(d);
  }
  return out;
}

// ---------------------------------------------------------------- derived values (scope 5.6)
function todayIn(zone = OFFICE_TZ) {
  return DateTime.now().setZone(zone).toISODate();
}

const daysBetween = (a, b) => Math.round(DateTime.fromISO(b).diff(DateTime.fromISO(a), 'days').days); // b − a

// Overdue / pending / due-in, the time bucket and its colour. Computed on read so screens, reports and
// reminders always agree.
function derive(task, today = todayIn()) {
  const closed = task.status === 'DONE' || task.status === 'NA';
  const due = task.dueDate || null;
  let overdueDays = 0;
  if (due && task.status !== 'NA') {
    const ref = task.status === 'DONE' ? (task.completedDate || today) : today;
    overdueDays = Math.max(0, daysBetween(due, ref));
  }
  const pendingDays = !closed && task.startDate && task.startDate <= today && due && due <= today ? daysBetween(due, today) : null;
  const dueInDays = due && due > today ? daysBetween(today, due) : null;
  let bucket;
  if (closed) bucket = 'CLOSED';
  else if (!due) bucket = 'AWAITING_DATE';
  else if (due < today) bucket = 'OVERDUE';
  else if (due === today) bucket = 'TODAY';
  else if (daysBetween(today, due) <= 7) bucket = 'NEXT_7';
  else bucket = 'LATER';
  const colour = { OVERDUE: 'red', TODAY: 'amber', NEXT_7: 'green', LATER: 'green', AWAITING_DATE: 'grey-outline', CLOSED: 'grey' }[bucket];
  return { overdueDays, pendingDays, dueInDays, bucket, colour, onTime: task.status === 'DONE' ? overdueDays === 0 : null };
}

module.exports = {
  resolveAnchor, computeDueDate, dueDateFor, recurrenceEnd, recurringDueDates, bunkerCallOf, derive, todayIn, daysBetween,
};
