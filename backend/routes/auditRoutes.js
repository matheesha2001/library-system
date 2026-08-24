const express = require('express');
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit-log - admin only, most recent first, optional ?action= filter
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { action } = req.query;
    const query = {};
    if (action) query.action = action;

    const logs = await AuditLog.find(query)
      .populate('actor', 'name email role')
      .sort({ timestamp: -1 })
      .limit(200);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
