const mongoose = require('mongoose');
const { STAGE_SCOPES, PORT_TYPES } = require('../../services/ops/constants');

// Stage master (feature A3). PORT_CALL stages repeat for every port call of portType.
const opsStageSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
  scope: { type: String, enum: STAGE_SCOPES, required: true },
  portType: {
    type: String,
    enum: [...PORT_TYPES, null],
    default: null,
    validate: {
      validator: function (v) { return this.scope !== 'PORT_CALL' || Boolean(v); },
      message: 'portType is required for PORT_CALL stages',
    },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('OpsStage', opsStageSchema);
