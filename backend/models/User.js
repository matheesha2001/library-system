const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    memberId: { type: String, unique: true, sparse: true, required: false },
    studentId: { type: String, trim: true },
    email: {
      type: String,
      required: function () {
        return !this.githubId;
      },
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.githubId;
      },
    },
    githubId: { type: String, unique: true, sparse: true },
    // Never queried by default (select: false) - only pulled in explicitly
    // by POST /auth/reset-password, matching how `password` itself is never
    // leaked through a plain .find()/.findById() elsewhere in this app.
    resetPasswordTokenHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    role: { type: String, enum: ['member', 'staff', 'admin'], default: 'member' },
    profilePicture: { type: String, default: '' },
    phoneNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    nicNumber: { type: String, trim: true },
    staffId: { type: String, trim: true },
    department: { type: String, trim: true },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
