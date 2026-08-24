const express = require('express');
const User = require('../models/User');
const BorrowRecord = require('../models/BorrowRecord');
const { protect, adminOnly, requireRole } = require('../middleware/auth');
const logAction = require('../utils/auditLog');

const router = express.Router();
const staffOrAdmin = requireRole('staff', 'admin');

// GET /api/users - List all users (staff or admin)
router.get('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const { search, role } = req.query;
    let query = {};

    if (role && ['member', 'staff', 'admin'].includes(role)) {
      query.role = role;
    }

    if (search) {
      if (search.length > 100) {
        return res.status(400).json({ message: 'Search term is too long' });
      }
      // Escape regex metacharacters before building the RegExp - unescaped
      // user input here could otherwise construct a catastrophic-backtracking
      // pattern (ReDoS) that stalls this query for every user.
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { memberId: regex },
        { studentId: regex },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    // Aggregate active loans count per user
    const activeBorrows = await BorrowRecord.aggregate([
      { $match: { returnDate: null } },
      { $group: { _id: '$member', activeCount: { $sum: 1 } } },
    ]);

    const activeMap = new Map(activeBorrows.map((b) => [String(b._id), b.activeCount]));

    const result = users.map((u) => {
      const doc = u.toObject();
      doc.activeBorrowsCount = activeMap.get(String(u._id)) || 0;
      return doc;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/users/:id - Get user profile + borrow history (staff or admin)
router.get('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const borrowHistory = await BorrowRecord.find({ member: req.params.id })
      .populate('book', 'title author isbn')
      .sort({ createdAt: -1 });

    res.json({
      user,
      borrowHistory,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/:id/role - Change user role (admin only - staff cannot
// promote/demote anyone, including themselves)
router.put('/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;

    if (!['member', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be member, staff, or admin.' });
    }

    // Prevent demoting self if demoting current logged-in user
    if (req.params.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ message: 'You cannot remove your own admin privileges.' });
    }

    const previous = await User.findById(req.params.id).select('role');
    if (!previous) return res.status(404).json({ message: 'User not found' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    await logAction(req.user.id, 'user.roleChange', 'User', user._id, {
      from: previous.role,
      to: user.role,
      targetName: user.name,
      targetEmail: user.email,
    });

    // Management-facing event - only staff/admin have a live user list to
    // update (see AdminUsers.jsx), so this only needs the staff room.
    req.io.to('staff').emit('userUpdated', { id: user._id, role: user.role });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/:id/block - Block a user's account (staff or admin).
// Staff may only block regular members, not other staff/admin accounts -
// that restriction stays admin-only.
router.put('/:id/block', protect, staffOrAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot block your own account.' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'staff' && target.role !== 'member') {
      return res.status(403).json({ message: 'Staff can only block member accounts.' });
    }

    target.isBlocked = true;
    await target.save();

    await logAction(req.user.id, 'user.block', 'User', target._id, {
      targetName: target.name,
      targetEmail: target.email,
    });

    req.io.to('staff').emit('userUpdated', { id: target._id, isBlocked: true });

    res.json({ id: target._id, isBlocked: target.isBlocked });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/:id/unblock - Unblock a user's account (staff or admin,
// same member-only restriction for staff as blocking)
router.put('/:id/unblock', protect, staffOrAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'staff' && target.role !== 'member') {
      return res.status(403).json({ message: 'Staff can only unblock member accounts.' });
    }

    target.isBlocked = false;
    await target.save();

    await logAction(req.user.id, 'user.unblock', 'User', target._id, {
      targetName: target.name,
      targetEmail: target.email,
    });

    req.io.to('staff').emit('userUpdated', { id: target._id, isBlocked: false });

    res.json({ id: target._id, isBlocked: target.isBlocked });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/users/:id - Delete a user account (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account from admin panel.' });
    }

    // Check if user has active borrowed books
    const activeBorrows = await BorrowRecord.countDocuments({
      member: req.params.id,
      returnDate: null,
    });

    if (activeBorrows > 0) {
      return res.status(400).json({
        message: `Cannot delete user with ${activeBorrows} unreturned book(s). Please process returns first.`,
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logAction(req.user.id, 'user.delete', 'User', user._id, {
      targetName: user.name,
      targetEmail: user.email,
    });

    // Clean up past returned borrow records or keep for log
    req.io.to('staff').emit('userDeleted', { id: req.params.id });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
