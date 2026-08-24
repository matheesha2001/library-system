const AuditLog = require('../models/AuditLog');

// Fire-and-forget: a failure to write the audit trail shouldn't block the
// actual block/unblock/role-change/delete action from completing, the same
// way a req.io.emit() failure elsewhere in this app never blocks a request -
// just log it server-side and move on.
async function logAction(actor, action, targetType, targetId, details) {
  try {
    await AuditLog.create({ actor, action, targetType, targetId, details });
  } catch (err) {
    console.error('Failed to write audit log entry:', err.message);
  }
}

module.exports = logAction;
