const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const generateMemberId = require('../utils/memberId');

const router = express.Router();

// POST /api/staff/register - admin only. Staff accounts are never
// self-registered or created by other staff, matching this project's
// existing "no public admin registration" pattern.
router.post('/register', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, staffId, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const memberId = await generateMemberId();

    const staff = await User.create({
      name,
      memberId,
      staffId,
      department,
      email,
      password: hashedPassword,
      role: 'staff',
    });

    res.status(201).json({
      id: staff._id,
      name: staff.name,
      memberId: staff.memberId,
      staffId: staff.staffId,
      department: staff.department,
      email: staff.email,
      role: staff.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
