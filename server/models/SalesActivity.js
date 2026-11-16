const mongoose = require('mongoose');

// One row per change made in Sales & Leads (client / lead, remark, event, meeting, task). Read by the
// daily summary email to the sales HOD (jobs/salesSummary.js). Kept 90 days.
const salesActivitySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, default: '' },
  entity: { type: String, enum: ['client', 'remark', 'event', 'meeting', 'task'], required: true },
  action: { type: String, enum: ['added', 'edited', 'deleted'], required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  clientName: { type: String, default: '' },
  leadType: { type: String, default: '' },             // Client / Lead, at the time of the change
  title: { type: String, default: '' },                // event / meeting / task title, or the remark text
  changes: [{ _id: false, field: String, from: String, to: String }],
  stageChange: { _id: false, from: String, to: String },
}, { versionKey: false });

salesActivitySchema.index({ at: 1, actor: 1 });
salesActivitySchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('SalesActivity', salesActivitySchema);
