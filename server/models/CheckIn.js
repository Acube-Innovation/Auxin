const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  eventType: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  location: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  notes: { type: String },
  imageProof: { type: String }, // store file path or URL
  timestamp: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // who filled the form
});

module.exports = mongoose.model('CheckIn', checkInSchema);
