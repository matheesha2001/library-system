const mongoose = require('mongoose');

// An immutable trail of sensitive staff/admin actions (blocks, unblocks,
// role changes, deletions) that were previously only ever broadcast live
// over Socket.io and never persisted anywhere. No updatedAt/{timestamps}
// here on purpose - a log entry is written once and never modified.
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g. 'user.block', 'user.roleChange', 'borrow.delete'
  targetType: { type: String, required: true }, // e.g. 'User', 'Book', 'BorrowRecord'
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed },
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
