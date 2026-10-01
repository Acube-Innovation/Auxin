// Database-backed scheduler for the Vessel Operations jobs (feature F6).
// Every 30 s each server instance looks for jobs whose nextRunAt has passed and claims one with an atomic
// update (lockedUntil), so a job runs once even with several instances. Schedules and last runs live in
// the opsjobs collection: after a restart, a run that was missed while the server was down happens once
// straight away ("catch-up"); reminders cannot be sent twice because each task records the reminders
// already sent (reminderSent).
const os = require('os');
const { DateTime } = require('luxon');
const OpsJob = require('../../models/ops/OpsJob');
const notifier = require('../../services/ops/notifier');
const { OFFICE_TZ, JOBS_ENABLED } = require('../../services/ops/config');
const { JOBS } = require('./definitions');

const TICK_MS = 30 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const INSTANCE = `${os.hostname()}:${process.pid}`;
let timer = null;

// Next run after `from`: daily at HH:MM office time, or every N minutes on the clock (…:00, :15, :30, :45)
function nextRun(schedule, from = new Date()) {
  const now = DateTime.fromJSDate(from).setZone(OFFICE_TZ);
  if (schedule.everyMinutes) {
    const n = schedule.everyMinutes;
    const next = now.startOf('minute').plus({ minutes: n - (now.minute % n) });
    return next.toJSDate();
  }
  const [h, m] = schedule.at.split(':').map(Number);
  let next = now.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  if (next <= now) next = next.plus({ days: 1 });
  return next.toJSDate();
}

const scheduleText = (s) => (s.everyMinutes ? `Every ${s.everyMinutes} minutes` : `Daily at ${s.at}`);

// Create missing job records; keep nextRunAt of existing ones (that is what makes catch-up work)
async function ensureJobs() {
  for (const def of JOBS) {
    const doc = await OpsJob.findOne({ name: def.name });
    if (!doc) await OpsJob.create({ name: def.name, nextRunAt: nextRun(def.schedule) });
    else if (!doc.nextRunAt) await OpsJob.updateOne({ _id: doc._id }, { $set: { nextRunAt: nextRun(def.schedule) } });
  }
}

async function execute(def, doc, trigger) {
  const started = Date.now();
  let result = null;
  let error = null;
  try {
    result = await def.run({ job: def.name, trigger });
  } catch (err) {
    error = err.message || String(err);
    console.error(`[ops-jobs] ${def.name} failed:`, err);
  }
  const update = {
    lockedUntil: null, lockedBy: null, lastFinishedAt: new Date(), lastDurationMs: Date.now() - started,
    lastResult: result, lastError: error, lastTrigger: trigger,
  };
  await OpsJob.updateOne({ _id: doc._id }, { $set: update, $inc: { runCount: 1 } });
  return { result, error, durationMs: update.lastDurationMs };
}

// Claim and run every job that is due
async function tick() {
  const now = new Date();
  for (const def of JOBS) {
    const doc = await OpsJob.findOneAndUpdate(
      { name: def.name, nextRunAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS), lockedBy: INSTANCE, lastStartedAt: now, nextRunAt: nextRun(def.schedule, now) } },
      { new: false },
    );
    if (!doc) continue;
    // More than one period late = the server was down when it was due
    const late = now - doc.nextRunAt > (def.schedule.everyMinutes ? def.schedule.everyMinutes * 60000 : 3600000);
    await execute(def, doc, late ? 'catch-up' : 'schedule');
  }
}

// Run a job now (admin "Run now"); the schedule is not changed. Refuses while the job is running.
async function runNow(name) {
  const def = JOBS.find((j) => j.name === name);
  if (!def) { const e = new Error('Unknown job'); e.status = 404; throw e; }
  await ensureJobs();
  const now = new Date();
  const doc = await OpsJob.findOneAndUpdate(
    { name, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS), lockedBy: INSTANCE, lastStartedAt: now } },
    { new: true },
  );
  if (!doc) { const e = new Error('This job is running right now; try again in a moment'); e.status = 409; throw e; }
  return execute(def, doc, 'manual');
}

async function list() {
  await ensureJobs();
  const docs = new Map((await OpsJob.find().lean()).map((d) => [d.name, d]));
  return JOBS.map((def) => ({ name: def.name, label: def.label, feature: def.feature, schedule: scheduleText(def.schedule), ...(docs.get(def.name) || {}), running: Boolean(docs.get(def.name)?.lockedUntil && new Date(docs.get(def.name).lockedUntil) > new Date()) }));
}

function start(io) {
  notifier.setIo(io);
  if (!JOBS_ENABLED) {
    console.log('[ops-jobs] scheduler disabled (OPS_JOBS_DISABLED=1)');
    return;
  }
  ensureJobs()
    .then(() => tick())
    .catch((err) => console.error('[ops-jobs] start failed:', err.message));
  timer = setInterval(() => tick().catch((err) => console.error('[ops-jobs] tick failed:', err.message)), TICK_MS);
  timer.unref();
  console.log(`[ops-jobs] scheduler started (office time ${OFFICE_TZ})`);
}

module.exports = { start, runNow, list, nextRun, tick };
