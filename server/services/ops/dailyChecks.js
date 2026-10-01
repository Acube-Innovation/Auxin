// Daily checklist per vessel status (features E1, D9; Development Scope 4.9).
// A DailyCheckLog per (voyage, office date) is created on first open (or by the nightly job, step 9)
// from the check set of the voyage's vessel status.
const Voyage = require('../../models/ops/Voyage');
const DailyCheckLog = require('../../models/ops/DailyCheckLog');
const DailyCheckTemplate = require('../../models/ops/DailyCheckTemplate');
const engine = require('./dueDateEngine');
const { LINKED_FIELDS } = require('./constants');

const effectiveStatus = (voyage) => (voyage.vesselStatusOverride && voyage.vesselStatusOverride.value) || voyage.vesselStatus;

async function templateItems(vesselStatus, session) {
  const set = await DailyCheckTemplate.findOne({ vesselStatus }).session(session || null).lean();
  if (!set) return [];
  return set.items.filter((i) => i.isActive !== false).sort((a, b) => a.order - b.order)
    .map((i) => ({ templateItem: i._id, code: i.code, name: i.name, order: i.order, vesselStatus, linkedField: i.linkedField || null }));
}

// Today's log of an active voyage, created or brought up to date with the current vessel status.
// Returns null for voyages that are not active.
async function ensureToday(voyageOrId, { session } = {}) {
  const voyage = voyageOrId && voyageOrId.status ? voyageOrId : await Voyage.findById(voyageOrId).session(session || null);
  if (!voyage || voyage.status !== 'ACTIVE') return null;
  const date = engine.todayIn();
  const status = effectiveStatus(voyage);
  let log = await DailyCheckLog.findOne({ voyage: voyage._id, date }).session(session || null);
  if (!log) {
    try {
      [log] = await DailyCheckLog.create([{ voyage: voyage._id, date, vesselStatus: status, statuses: [status], items: await templateItems(status, session) }], { session });
      return log;
    } catch (err) {
      if (err.code !== 11000) throw err;
      log = await DailyCheckLog.findOne({ voyage: voyage._id, date }).session(session || null); // created meanwhile
    }
  }
  if (!log.statuses.includes(status)) {
    // Status changed during the day: add the new set's checks, keep what was already ticked.
    // A check already on today's list (same name, e.g. "Check Weather Updates") is not added twice.
    const key = (name) => name.trim().toLowerCase();
    const have = new Set(log.items.flatMap((i) => [i.code, key(i.name)]));
    const base = log.items.reduce((m, i) => Math.max(m, i.order), 0);
    for (const it of await templateItems(status, session)) {
      if (!have.has(it.code) && !have.has(key(it.name))) log.items.push({ ...it, order: base + it.order });
    }
    log.statuses.push(status);
  }
  if (log.vesselStatus !== status) log.vesselStatus = status;
  if (log.isModified()) await log.save({ session });
  return log;
}

const fieldLabel = (path) => {
  const generic = path.replace(/^portCall\.(LOADING|DISCHARGING|BUNKERING)\./, 'portCall.');
  return (LINKED_FIELDS.find((f) => f.value === generic) || {}).label || path;
};

// D9: today's open checks linked to a date that was just entered tick themselves.
// changes: [{ field: 'portCall.planned.eta' | 'delivery.estimated' | …, portCall, portType }]
async function tickLinked(voyageId, changes, { session, user } = {}) {
  if (!changes || !changes.length) return 0;
  const log = await ensureToday(voyageId, { session });
  if (!log) return 0;
  const wanted = new Map();
  for (const c of changes) {
    wanted.set(c.field, c.field);
    if (c.field.startsWith('portCall.') && c.portType) wanted.set(`portCall.${c.portType}.${c.field.slice('portCall.'.length)}`, c.field);
  }
  let n = 0;
  const now = new Date();
  for (const item of log.items) {
    if (item.done || !item.linkedField || !wanted.has(item.linkedField)) continue;
    item.done = true;
    item.auto = true;
    item.doneBy = user ? user._id : null;
    item.doneAt = now;
    item.autoNote = `Ticked automatically when ${fieldLabel(item.linkedField)} was entered`;
    n++;
  }
  if (n) await log.save({ session });
  return n;
}

// Preview of the checks for a status (future dates)
async function previewItems(voyage) {
  return templateItems(effectiveStatus(voyage));
}

module.exports = { ensureToday, tickLinked, previewItems, effectiveStatus, templateItems };
