const mongoose = require('mongoose');

const isValidTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
};

// Port master (feature A2). timeZone is an IANA name, e.g. Asia/Muscat.
const portSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  unlocode: {
    type: String,
    trim: true,
    uppercase: true,
    set: (v) => (v === '' || v === null ? undefined : v),
    validate: { validator: (v) => v === undefined || /^[A-Za-z]{2}[A-Za-z0-9]{3}$/.test(v), message: 'UN/LOCODE must be 5 characters, e.g. OMSLL' },
  },
  timeZone: {
    type: String,
    required: true,
    validate: { validator: isValidTimeZone, message: (p) => `"${p.value}" is not a valid IANA time zone` },
  },
  defaultAgents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }],
  notes: { type: String },        // restrictions, draft limits etc.
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

portSchema.index({ name: 1, country: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
portSchema.index({ unlocode: 1 }, { unique: true, partialFilterExpression: { unlocode: { $type: 'string' } } });

module.exports = mongoose.model('Port', portSchema);
module.exports.isValidTimeZone = isValidTimeZone;
