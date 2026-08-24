const mongoose = require('mongoose');

// Generic atomic counter collection - one document per named sequence
// (e.g. "memberId_2026"). $inc on findOneAndUpdate is atomic in MongoDB,
// so concurrent registrations can't land on the same sequence number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
