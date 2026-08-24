const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { SUPPORTED_IMAGE_TYPES, detectImageExtension } = require('../utils/imageSignature');

const router = express.Router();

// Only formats every mainstream browser can actually render in an <img> tag.
// HEIC/HEIF (the default photo format on iPhones) reports a mimetype that
// starts with "image/" and would otherwise pass a naive check, but no
// browser besides Safari can decode it - it uploads "successfully" and then
// just never displays. Reject it here with a clear message instead.
//
// This is only a cheap first pass on the client-declared mimetype, so an
// obviously-wrong upload never gets buffered into memory at all - it is NOT
// trusted for anything past that. The actual accept/reject decision, and the
// extension used for the stored filename, come from detectImageExtension()
// in the route handler below, which checks the real bytes instead. A
// request could otherwise declare an allowed mimetype (e.g. image/png)
// while the content is something else entirely and get it saved/served
// under a mismatched extension - or saved at all.
//
// memoryStorage (not diskStorage) so the buffer is available for that check
// before anything is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
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

    // The declared mimetype only passed the cheap fileFilter check above -
    // that's just what the client claimed. Verify the actual bytes match a
    // real image signature before this file is trusted with anything,
    // including the extension it gets stored under.
    const ext = detectImageExtension(req.file.buffer);
    if (!ext) {
      return res.status(400).json({ message: 'The uploaded file is not a valid JPG, PNG, GIF, or WebP image.' });
    }

    try {
      const filename = `${req.user.id}-${Date.now()}${ext}`;
      await fs.writeFile(path.join(__dirname, '..', 'uploads', 'profiles', filename), req.file.buffer);

      const profilePicture = `/uploads/profiles/${filename}`;
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
