const mongoose = require('mongoose');

// Every email the Vessel Operations module produces (reminders, morning summary, escalation, ETA change),
// whether it was sent, skipped (email not configured) or failed. Kept 60 days. Admins can read them in
// Ops Masters → Scheduled Jobs, which is also how emails are checked on a system without SMTP.
const opsEmailLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  kind: { type: String, required: true },             // REMINDER | DIGEST | ESCALATION | ETA_CHANGE
  to: { type: String, required: true },
  toName: { type: String },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'SKIPPED', 'FAILED'], required: true },
  error: { type: String },
  job: { type: String },
}, { versionKey: false });

opsEmailLogSchema.index({ at: -1 });
opsEmailLogSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

module.exports = mongoose.model('OpsEmailLog', opsEmailLogSchema);
