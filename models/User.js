const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    studentId: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: function () {
        return !this.githubId;
      },
    },
    githubId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
