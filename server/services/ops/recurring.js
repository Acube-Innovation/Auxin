// Recurring voyage tasks (feature E2), e.g. hire payment every 15 days from delivery until re-delivery.
// Activation creates instance #1; this generates the next instances once they fall due within the
// look-ahead window, and closes instances that a changed end date (re-delivery) has made unnecessary.
// Runs after recalculations, when the task list / daily checks are opened, and nightly (step 9).
const Voyage = require('../../models/ops/Voyage');
const PortCall = require('../../models/ops/PortCall');
const VoyageTask = require('../../models/ops/VoyageTask');
const engine = require('./dueDateEngine');
const { RECURRING_LOOKAHEAD_DAYS } = require('./config');
const { DateTime } = require('luxon');

const idOf = (v) => (v ? String(v._id || v) : null);

async function generateRecurring(voyageId, { session, user = null } = {}) {
  const voyage = await Voyage.findById(voyageId).session(session || null);
  if (!voyage || voyage.status !== 'ACTIVE') return { created: 0, closed: 0 };
  const series = await VoyageTask.find({ voyage: voyage._id, 'recurrence.everyDays': { $gt: 0 }, recurrenceIndex: { $ne: null } })
    .sort({ recurrenceIndex: 1 }).session(session || null);
  if (!series.length) return { created: 0, closed: 0 };
  const portCalls = await PortCall.find({ voyage: voyage._id }).populate('port', 'name').sort({ seq: 1 }).session(session || null).lean();
  const limit = DateTime.fromISO(engine.todayIn()).plus({ days: RECURRING_LOOKAHEAD_DAYS }).toISODate();

  const groups = new Map();
  for (const t of series) {
    const key = `${idOf(t.template) || t.code || t.baseName}:${idOf(t.portCall) || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const now = new Date();
  const docs = [];
  let closed = 0;
  for (const tasks of groups.values()) {
    const base = tasks[0];
    if (base.status === 'NA') continue; // the whole series was marked not applicable
    const pc = base.portCall ? portCalls.find((p) => idOf(p) === idOf(base.portCall)) : null;
    const dates = engine.recurringDueDates(base, voyage, pc, portCalls);
    const have = new Set(tasks.map((t) => t.recurrenceIndex));
    dates.forEach((d, k) => {
      if (have.has(k) || d > limit) return;
      const n = k + 1;
      const label = `${base.baseName || base.name} #${n}`;
      docs.push({
        voyage: voyage._id, portCall: base.portCall, template: base.template, code: base.code,
        name: pc && pc.port ? `${pc.port.name} – ${label}` : label, baseName: label,
        instructions: base.instructions, stage: base.stage, sortKey: base.sortKey,
        anchor: base.anchor, offsetDays: base.offsetDays, recurrence: base.recurrence, recurrenceIndex: k,
        dueDate: d, priority: base.priority, reminderProfile: base.reminderProfile,
        linkedField: base.linkedField, autoCompleteOnField: base.autoCompleteOnField, assignedTo: base.assignedTo,
        history: [{ at: now, by: user ? user._id : null, field: 'created', note: `Recurring task #${n} generated (every ${base.recurrence.everyDays} days)`, auto: true }],
        createdBy: user ? user._id : null,
      });
    });
    // Instances beyond the (new) end of the cycle are no longer needed
    for (const t of tasks) {
      if (t.recurrenceIndex > 0 && t.recurrenceIndex >= dates.length && dates.length && ['NOT_STARTED', 'INITIATED', 'AWAITING'].includes(t.status)) {
        t.history.push({ at: now, by: user ? user._id : null, field: 'status', from: t.status, to: 'NA', note: 'After the end of the recurring cycle (re-delivery moved)', auto: true });
        t.status = 'NA';
        t.naReason = 'After the end of the recurring cycle';
        await t.save({ session });
        closed++;
      }
    }
  }
  if (docs.length) await VoyageTask.insertMany(docs, { session });
  return { created: docs.length, closed };
}

module.exports = { generateRecurring };
