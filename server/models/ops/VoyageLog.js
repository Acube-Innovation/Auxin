const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Voyage-level activity that is not a date revision (feature D10 / workspace Activity tab):
// created, copied, activated, status changes, vessel status set by hand, port calls added / cancelled / re-ordered.
const voyageLogSchema = new mongoose.Schema({
  voyage: { type: ObjectId, ref: 'Voyage', required: true },
  at: { type: Date, default: Date.now },
  by: { type: ObjectId, ref: 'User', default: null },
  type: { type: String, required: true },   // e.g. CREATED, ACTIVATED, STATUS, VESSEL_STATUS, PORT_CALL_ADDED
  text: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { versionKey: false });

voyageLogSchema.index({ voyage: 1, at: -1 });

const VoyageLog = mongoose.model('VoyageLog', voyageLogSchema);

// Write a log entry; never fails the request it belongs to
VoyageLog.write = async (voyageId, user, type, text, meta, session) => {
  try {
    await VoyageLog.create([{ voyage: voyageId, by: user ? user._id : null, type, text, meta }], session ? { session } : undefined);
  } catch (err) {
    console.error('VoyageLog write failed:', err.message);
  }
};

module.exports = VoyageLog;
