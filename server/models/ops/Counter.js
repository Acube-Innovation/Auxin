const mongoose = require('mongoose');

// Named sequence counters, e.g. { _id: 'voyage-2026', seq: 12 }
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
}, { versionKey: false });

const Counter = mongoose.model('Counter', counterSchema);

// Atomically take the next number of a sequence
Counter.next = async (name) => {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

module.exports = Counter;
