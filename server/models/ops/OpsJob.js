const mongoose = require('mongoose');

// Scheduled job state for Vessel Operations (feature F6): kept in the database so that schedules,
// last runs and locks survive restarts and a second server instance never runs the same job twice.
const opsJobSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  nextRunAt: { type: Date, default: null },
  lockedUntil: { type: Date, default: null },
  lockedBy: { type: String, default: null },
  lastStartedAt: { type: Date, default: null },
  lastFinishedAt: { type: Date, default: null },
  lastDurationMs: { type: Number, default: null },
  lastResult: { type: mongoose.Schema.Types.Mixed, default: null },
  lastError: { type: String, default: null },
  lastTrigger: { type: String, default: null },       // 'schedule' | 'manual' | 'catch-up'
  runCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('OpsJob', opsJobSchema);
