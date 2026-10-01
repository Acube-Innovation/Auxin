const mongoose = require('mongoose');
const { VESSEL_STATUS_VALUES, LINKED_FIELD_VALUES, SOURCE_TAGS } = require('../../services/ops/constants');

// Daily checks per vessel status (feature A5). One document per vessel status.
const itemSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  linkedField: { type: String, enum: [...LINKED_FIELD_VALUES, null], default: null },
  sourceTag: { type: String, enum: SOURCE_TAGS, default: 'USER' },
  sourceNote: { type: String },
  isActive: { type: Boolean, default: true },
}, { _id: true });

const dailyCheckTemplateSchema = new mongoose.Schema({
  vesselStatus: { type: String, enum: VESSEL_STATUS_VALUES, required: true, unique: true },
  items: [itemSchema],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('DailyCheckTemplate', dailyCheckTemplateSchema);
