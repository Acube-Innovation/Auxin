const mongoose = require('mongoose');
const { VESSEL_STATUS_VALUES } = require('../../services/ops/constants');

const { ObjectId } = mongoose.Schema.Types;

// One day's checklist of a voyage (feature E1, Development Scope 4.9). Unique (voyage, date).
// Built from the DailyCheckTemplate of the vessel status; if the status changes during the day,
// the new status' items are added (statuses[] lists every set used that day).
const itemSchema = new mongoose.Schema({
  templateItem: { type: ObjectId, default: null },
  code: { type: String, required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  vesselStatus: { type: String, enum: VESSEL_STATUS_VALUES },
  linkedField: { type: String, default: null },
  done: { type: Boolean, default: false },
  doneBy: { type: ObjectId, ref: 'User', default: null },
  doneAt: { type: Date, default: null },
  auto: { type: Boolean, default: false },      // ticked by entering the linked field (D9)
  autoNote: { type: String },
  remark: { type: String, default: '' },
  remarkBy: { type: ObjectId, ref: 'User', default: null },
  remarkAt: { type: Date, default: null },
}, { _id: true });

const dailyCheckLogSchema = new mongoose.Schema({
  voyage: { type: ObjectId, ref: 'Voyage', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },   // office-time-zone calendar date
  vesselStatus: { type: String, enum: VESSEL_STATUS_VALUES },          // latest status of the day
  statuses: [{ type: String, enum: VESSEL_STATUS_VALUES }],
  items: [itemSchema],
}, { timestamps: true });

dailyCheckLogSchema.index({ voyage: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyCheckLog', dailyCheckLogSchema);
