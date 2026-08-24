const Counter = require('../models/Counter');

// Generates the next Member ID in the format LIB<year><seq>, e.g. LIB2026001.
// The sequence is tracked per year in the Counter collection, so it
// naturally resets to 001 on the first registration of a new year.
async function generateMemberId() {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { _id: `memberId_${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = String(counter.seq).padStart(3, '0');
  return `LIB${year}${seq}`;
}

module.exports = generateMemberId;
