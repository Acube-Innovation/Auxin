const mongoose = require('mongoose');
const { VOYAGE_TYPES, VESSEL_STATUS_VALUES } = require('../../services/ops/constants');

const { ObjectId } = mongoose.Schema.Types;
const VOYAGE_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

// Delivery / re-delivery point. Times are UTC instants; timeZone is the zone they are entered and shown in.
const handoverSchema = new mongoose.Schema({
  place: { type: String, trim: true },
  port: { type: ObjectId, ref: 'Port', default: null },
  timeZone: { type: String },
  estimated: { type: Date, default: null },
  original: { type: Date, default: null },   // frozen when the voyage is activated
  actual: { type: Date, default: null },
}, { _id: false });

const cargoSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, min: 0 },
  unit: { type: String, default: 'MT', trim: true },
  packages: { type: Number, min: 0 },
  packageUnit: { type: String, trim: true },
  remarks: { type: String },
});

// Voyage (operation) — features B1–B8. Port calls live in their own collection (PortCall).
const voyageSchema = new mongoose.Schema({
  voyageNo: { type: String, required: true, unique: true },     // VOY-YYYY-####
  status: { type: String, enum: VOYAGE_STATUSES, default: 'DRAFT', required: true },
  voyageType: { type: String, enum: VOYAGE_TYPES, default: 'TC_TRIP' },
  vesselStatus: { type: String, enum: VESSEL_STATUS_VALUES, default: 'AWAITING_DELIVERY' },
  vesselStatusOverride: {
    value: { type: String, enum: [...VESSEL_STATUS_VALUES, null], default: null },
    setBy: { type: ObjectId, ref: 'User', default: null },
    setAt: { type: Date, default: null },
  },

  vessel: { type: ObjectId, ref: 'Vessel', required: true },
  master: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  charterers: { type: ObjectId, ref: 'Client', default: null },
  owners: { type: ObjectId, ref: 'Client', default: null },
  brokers: [{ type: ObjectId, ref: 'Client' }],
  operators: [{ type: ObjectId, ref: 'Employee' }],

  fixture: {
    cargoFixedAt: { type: Date, default: null },
    vesselFixedAt: { type: Date, default: null },
    cargoLaycanFrom: { type: Date, default: null },
    cargoLaycanTo: { type: Date, default: null },
    vesselLaycanFrom: { type: Date, default: null },
    vesselLaycanTo: { type: Date, default: null },
    cpDate: { type: Date, default: null },
  },
  cargo: [cargoSchema],
  delivery: { type: handoverSchema, default: () => ({}) },
  redelivery: { type: handoverSchema, default: () => ({}) },
  bunker: {
    bookedOn: { type: Date, default: null },
    bunkeringDate: { type: Date, default: null },
    supplier: { type: ObjectId, ref: 'Client', default: null },
    grade: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    portCall: { type: ObjectId, ref: 'PortCall', default: null },
  },

  copiedFrom: { type: ObjectId, ref: 'Voyage', default: null },
  remarks: { type: String },
  createdBy: { type: ObjectId, ref: 'User' },
  updatedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

voyageSchema.index({ status: 1, updatedAt: -1 });
voyageSchema.index({ operators: 1, status: 1 });
voyageSchema.index({ vessel: 1 });

module.exports = mongoose.model('Voyage', voyageSchema);
module.exports.VOYAGE_STATUSES = VOYAGE_STATUSES;
