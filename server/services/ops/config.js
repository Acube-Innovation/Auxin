// Settings for the Vessel Operations module. Override in server/.env.
const { isValidTimeZone } = require('../../models/ops/Port');

const officeTz = process.env.OPS_OFFICE_TZ || 'Asia/Kolkata'; // operations office time zone (to be confirmed by client)
if (!isValidTimeZone(officeTz)) {
  throw new Error(`OPS_OFFICE_TZ "${officeTz}" is not a valid IANA time zone`);
}

const num = (name, fallback) => {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a number of 0 or more`);
  return n;
};

module.exports = {
  OFFICE_TZ: officeTz,
  // ETB / ETC / ETS suggestions (Development Scope 5.7, values from the client's OPS sheet)
  WAIT_HOURS_CARGO: num('OPS_WAIT_HOURS_CARGO', 4.8),      // ETB = ETA + 4.8 h at load / discharge ports
  WAIT_HOURS_BUNKER: num('OPS_WAIT_HOURS_BUNKER', 12),     // ETB = ETA + 12 h at bunkering ports
  DEFAULT_OPS_DAYS: num('OPS_DEFAULT_OPS_DAYS', 4),        // ETC = ETB + 4 days when quantity or rate is missing
  DEFAULT_BUNKER_DAYS: num('OPS_DEFAULT_BUNKER_DAYS', 1),  // bunkering calls: ETC = ETB + 1 day (our assumption — to confirm)
  SAIL_BUFFER_HOURS: num('OPS_SAIL_BUFFER_HOURS', 0),      // ETS = ETC + buffer
  DUE_SOON_DAYS: num('OPS_DUE_SOON_DAYS', 2),              // "due within 48 hours" in the ETA-change alert
  // Reminders, morning summary, escalation (features F1, F2, F4, F5)
  REMINDER_TIME: process.env.OPS_REMINDER_TIME || '09:00',  // reminders are sent from this office time on
  DIGEST_TIME: process.env.OPS_DIGEST_TIME || '07:30',
  ESCALATION_TIME: process.env.OPS_ESCALATION_TIME || '09:00',
  ESCALATE_HIGH_DAYS: num('OPS_ESCALATE_HIGH_DAYS', 1),    // HIGH tasks escalate when overdue more than 1 day
  ESCALATE_OTHER_DAYS: num('OPS_ESCALATE_OTHER_DAYS', 2),  // others after more than 2 days
  ESCALATION_ROLES: (process.env.OPS_ESCALATION_ROLES || 'chartering_manager,operations_pricing_manager').split(',').map((s) => s.trim()).filter(Boolean),
  APP_URL: (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  JOBS_ENABLED: process.env.OPS_JOBS_DISABLED !== '1',
  RECURRING_LOOKAHEAD_DAYS: num('OPS_RECURRING_LOOKAHEAD_DAYS', 7), // next recurring instance appears this many days before it is due
};
