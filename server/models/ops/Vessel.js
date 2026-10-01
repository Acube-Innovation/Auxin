const mongoose = require('mongoose');

// Vessel master (feature A1)
const vesselSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  imo: {
    type: String,
    trim: true,
    set: (v) => (v === '' || v === null ? undefined : v),
    validate: { validator: (v) => v === undefined || /^\d{7}$/.test(v), message: 'IMO number must be 7 digits' },
  },
  type: { type: String, trim: true },          // e.g. Supramax, Ultramax, Handysize
  dwt: { type: Number, min: 0 },
  flag: { type: String, trim: true },
  yearBuilt: { type: Number, min: 1900, max: 2100 },
  owners: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  ownersBroker: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Name unique regardless of case; IMO unique when present
vesselSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
vesselSchema.index({ imo: 1 }, { unique: true, partialFilterExpression: { imo: { $type: 'string' } } });

module.exports = mongoose.model('Vessel', vesselSchema);
