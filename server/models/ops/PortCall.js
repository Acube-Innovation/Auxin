const mongoose = require('mongoose');
const { PORT_TYPES } = require('../../services/ops/constants');

const { ObjectId } = mongoose.Schema.Types;
const times = (fields) => Object.fromEntries(fields.map((f) => [f, { type: Date, default: null }]));

// One call in a voyage's port rotation (features B6, C1). Separate collection because port calls
// are updated often and independently, and voyage tasks reference them.
const portCallSchema = new mongoose.Schema({
  voyage: { type: ObjectId, ref: 'Voyage', required: true },
  seq: { type: Number, required: true },                  // 1, 2, 3 … order in the rotation
  port: { type: ObjectId, ref: 'Port', required: true },
  timeZone: { type: String, required: true },              // copied from the port
  type: { type: String, enum: PORT_TYPES, required: true },
  agent: { type: ObjectId, ref: 'Client', default: null },
  cargoQty: { type: Number, min: 0, default: null },
  ratePerDay: { type: Number, min: 0, default: null },     // load / discharge rate, for the ETC suggestion

  planned: times(['eta', 'etb', 'etc', 'ets']),             // latest estimates
  original: times(['eta', 'etb', 'etc', 'ets']),            // frozen at voyage activation
  manual: {                                                 // user typed the value; suggestions must not overwrite it
    etb: { type: Boolean, default: false },
    etc: { type: Boolean, default: false },
    ets: { type: Boolean, default: false },
  },
  actual: times(['ata', 'norTendered', 'pob', 'atb', 'commenced', 'completed', 'atd']),

  status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE' },
  remarks: { type: String },
  updatedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

portCallSchema.index({ voyage: 1, seq: 1 }, { unique: true });
portCallSchema.index({ port: 1 });
portCallSchema.index({ agent: 1 });

module.exports = mongoose.model('PortCall', portCallSchema);
