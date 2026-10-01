const mongoose = require('mongoose');
const { ANCHOR_EVENT_VALUES, ANCHOR_BASES, PRIORITIES, REMINDER_PROFILES, LINKED_FIELD_VALUES } = require('../../services/ops/constants');

const { ObjectId } = mongoose.Schema.Types;
const TASK_STATUSES = ['NOT_STARTED', 'INITIATED', 'AWAITING', 'DONE', 'NA'];
const localDate = { type: String, default: null, match: [/^\d{4}-\d{2}-\d{2}$/, 'must be a date YYYY-MM-DD'] };

// A task of one voyage (features D1–D10). The rule is copied from the template at generation time,
// so later template edits never change a running voyage.
const voyageTaskSchema = new mongoose.Schema({
  voyage: { type: ObjectId, ref: 'Voyage', required: true },
  portCall: { type: ObjectId, ref: 'PortCall', default: null },      // set for per-port-call stages
  template: { type: ObjectId, ref: 'TaskTemplate', default: null },   // null for ad-hoc tasks
  code: { type: String, default: null },                              // template code, e.g. T043

  name: { type: String, required: true, trim: true },                 // "Salalah – Appoint Loadport Agent"
  baseName: { type: String, trim: true },                             // name without the port prefix
  instructions: { type: String },
  stage: { type: ObjectId, ref: 'OpsStage', default: null },
  sortKey: { type: Number, default: 0 },                              // stage order, port-call seq, template order

  anchor: {
    event: { type: String, enum: [...ANCHOR_EVENT_VALUES, null], default: null },
    basis: { type: String, enum: ANCHOR_BASES, default: 'BEST' },
  },
  offsetDays: { type: Number, default: 0 },
  recurrence: {
    everyDays: { type: Number, default: null },
    until: { type: String, enum: [...ANCHOR_EVENT_VALUES, null], default: null },
  },
  recurrenceIndex: { type: Number, default: null },                   // 0, 1, 2 … for recurring tasks

  dueDate: localDate,                                                 // null while the key date is unknown
  dueOverridden: { type: Boolean, default: false },                   // user set the due date by hand
  startDate: localDate,
  completedDate: localDate,

  status: { type: String, enum: TASK_STATUSES, default: 'NOT_STARTED', required: true },
  naReason: { type: String },
  priority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
  reminderProfile: { type: String, enum: REMINDER_PROFILES, default: 'MEDIUM' },
  isOptional: { type: Boolean, default: false },
  linkedField: { type: String, enum: [...LINKED_FIELD_VALUES, null], default: null },
  autoCompleteOnField: { type: Boolean, default: false },

  assignedTo: [{ type: ObjectId, ref: 'Employee' }],
  remarks: { type: String },
  attachments: [{
    fileName: String, filePath: String, fileType: String, fileSize: Number,
    uploadedBy: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now },
  }],

  reminderSent: [{ type: String }],                                   // idempotency keys for reminders (step 9)
  history: [{
    at: { type: Date, default: Date.now },
    by: { type: ObjectId, ref: 'User', default: null },
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    note: String,
  }],
  createdBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

voyageTaskSchema.index({ voyage: 1, status: 1, dueDate: 1 });
voyageTaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
voyageTaskSchema.index({ status: 1, dueDate: 1 });
voyageTaskSchema.index({ voyage: 1, sortKey: 1 });

module.exports = mongoose.model('VoyageTask', voyageTaskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;
