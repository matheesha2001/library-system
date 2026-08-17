const mongoose = require('mongoose');

// User entity - covers both library members and admins
// This is one of our 3 required CRUD entities
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // stored as a bcrypt hash, never plain text
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
