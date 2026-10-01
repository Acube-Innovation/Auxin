const mongoose = require('mongoose');
const {
  ANCHOR_EVENT_VALUES, ANCHOR_BASES, PRIORITIES, REMINDER_PROFILES, VOYAGE_TYPES, SOURCE_TAGS, LINKED_FIELD_VALUES,
} = require('../../services/ops/constants');

// Task template library (feature A4). Voyages copy what they need at generation time,
// so editing a template never changes a running voyage.
const taskTemplateSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },   // e.g. T043
  name: { type: String, required: true, trim: true },
  instructions: { type: String },
  stage: { type: mongoose.Schema.Types.ObjectId, ref: 'OpsStage', required: true },

  // Due-date rule: due = anchor event (calendar date in port / office time zone) + offsetDays
  anchor: {
    event: { type: String, enum: ANCHOR_EVENT_VALUES, required: true },
    basis: { type: String, enum: ANCHOR_BASES, default: 'BEST' },
  },
  offsetDays: { type: Number, required: true, validate: { validator: Number.isInteger, message: 'offsetDays must be a whole number' } },
  recurrence: {
    everyDays: { type: Number, min: 1, default: null },
    until: { type: String, enum: [...ANCHOR_EVENT_VALUES, null], default: null },
  },

  defaultPriority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
  priorityDefaulted: { type: Boolean, default: false },    // true when the client sheet gave no priority
  reminderProfile: { type: String, enum: REMINDER_PROFILES, default: 'MEDIUM' },
  defaultRole: { type: String, default: null },             // User.role value; null = voyage operator
  isOptional: { type: Boolean, default: false },            // pre-unticked in the generation preview
  linkedField: { type: String, enum: [...LINKED_FIELD_VALUES, null], default: null },
  autoCompleteOnField: { type: Boolean, default: false },
  voyageTypes: [{ type: String, enum: VOYAGE_TYPES }],      // empty = applies to every voyage type

  sourceTag: { type: String, enum: SOURCE_TAGS, default: 'USER' },
  sourceNote: { type: String },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

taskTemplateSchema.index({ stage: 1, sortOrder: 1 });

module.exports = mongoose.model('TaskTemplate', taskTemplateSchema);
