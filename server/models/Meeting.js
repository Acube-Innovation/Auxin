const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, default: 'meeting' },
  date: { type: Date, required: true },
  time: { type: String }, // "HH:MM"
  // clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  assignedTeamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  notes: { type: String, default: '' },
  link: { type: String, default: '' },
  color: { type: String },
  reminders: [{ type: Number, default: [] }], // array of minutes before meeting (e.g., [15, 60, 1440])
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
