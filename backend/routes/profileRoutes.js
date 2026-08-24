const express = require('express');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Only formats every mainstream browser can actually render in an <img> tag.
// HEIC/HEIF (the default photo format on iPhones) reports a mimetype that
// starts with "image/" and would otherwise pass a naive check, but no
// browser besides Safari can decode it - it uploads "successfully" and then
// just never displays. Reject it here with a clear message instead.
//
// Maps each accepted mimetype to a fixed extension. The stored filename's
// extension always comes from this map (keyed by the mimetype fileFilter
// already validated), NEVER from the client-supplied originalname - otherwise
// a request could declare an allowed mimetype (e.g. image/png) alongside a
// mismatched filename like "x.svg" and get the file stored/served with that
// extension instead, regardless of what was actually validated.
const SUPPORTED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'profiles'));
  },
  filename: (req, file, cb) => {
    const ext = SUPPORTED_IMAGE_TYPES[file.mimetype] || '';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!SUPPORTED_IMAGE_TYPES[file.mimetype]) {
      return cb(new Error('Unsupported image format. Please upload a JPG, PNG, GIF, or WebP image (HEIC/HEIF photos from iPhones are not supported by web browsers - convert it or choose "Most Compatible" when exporting/sharing).'));
    }
    cb(null, true);
  },
});

// GET /api/profile - the current logged-in user's own profile
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/profile - update profile details
router.put('/', protect, async (req, res) => {
  try {
    const { name, email, phoneNumber, address, gender, nicNumber } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const update = { name, email, phoneNumber, address, nicNumber };
    // Only set gender if a valid, non-empty value was sent - an empty string
    // would otherwise fail the schema's enum validation.
    if (gender) update.gender = gender;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/profile/picture - upload/replace the profile picture
router.post('/picture', protect, (req, res) => {
  upload.single('profilePicture')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    try {
      const profilePicture = `/uploads/profiles/${req.file.filename}`;
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { profilePicture },
        { new: true }
      ).select('-password');

      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (updateErr) {
      res.status(500).json({ message: 'Server error', error: updateErr.message });
    }
  });
});

module.exports = router;
