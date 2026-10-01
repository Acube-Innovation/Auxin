const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Audit of every key-date change on an active voyage (feature C3): who changed which date, when,
// from what to what, why, and how many task due dates moved as a result.
const dateRevisionSchema = new mongoose.Schema({
  voyage: { type: ObjectId, ref: 'Voyage', required: true },
  portCall: { type: ObjectId, ref: 'PortCall', default: null },
  field: { type: String, required: true },           // e.g. planned.eta, actual.atd, delivery.estimated
  from: { type: Date, default: null },
  to: { type: Date, default: null },
  by: { type: ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now },
  reason: { type: String },
  tasksMoved: { type: Number, default: 0 },
}, { versionKey: false });

dateRevisionSchema.index({ voyage: 1, at: -1 });

module.exports = mongoose.model('DateRevision', dateRevisionSchema);
