const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const generateMemberId = require('../utils/memberId');

const router = express.Router();

// One client instance reused across the /google and /google/callback routes
// below - it already knows this app's clientId/clientSecret/redirectUri, so
// individual calls only need to pass the request-specific bits (scopes,
// the authorization code).
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_CALLBACK_URL,
});

// Stricter limit on login specifically, to slow down credential stuffing -
// only failed attempts count against it, so a legitimate user logging in
// repeatedly (or several users sharing an IP) isn't penalized.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, studentId, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const memberId = await generateMemberId();

    const user = await User.create({
      name,
      memberId,
      studentId,
      email,
      password: hashedPassword,
      // Public self-registration can only ever create a member account.
      // Staff/admin accounts are provisioned separately (POST /api/staff/register,
      // PUT /api/users/:id/role, or scripts/createAdmin.js) - any "role" field
      // sent by the client on this route is intentionally ignored.
      role: 'member',
    });

    res.status(201).json({ id: user._id, name: user.name, memberId: user.memberId, studentId: user.studentId, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // password is select: false on the model now - explicitly requested
    // here since this is the one route that actually needs to compare it.
    const user = await User.findOne({ email }).select('+password');

    // TEMP DEBUG - remove after diagnosing the mathiya040@gmail.com login issue.
    console.log('[login debug]', {
      emailSubmitted: email,
      userFound: !!user,
      hasPasswordSet: user ? !!user.password : null,
      role: user ? user.role : null,
      isBlocked: user ? user.isBlocked : null,
      note: 'role is NOT checked by this route - any valid role can log in here',
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google sign-in. Please use the 'Sign in with Google' button." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    // TEMP DEBUG - remove after diagnosing.
    console.log('[login debug] password match result:', isMatch);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'This account has been blocked. Please contact library staff.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, memberId: user.memberId, studentId: user.studentId, email: user.email, role: user.role, profilePicture: user.profilePicture },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Same response whether or not the account exists - both the message
    // AND the response shape have to stay identical, or the shape itself
    // becomes an oracle for account existence (e.g. a client checking
    // `if (resetLink)` could otherwise fingerprint registered emails even
    // with an identical message). That's why resetLink/resetToken are never
    // included in the response below, regardless of which branch runs here.
    const genericMessage = 'If that email is registered, a password reset link has been generated.';
    const user = await User.findOne({ email });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await user.save();

      const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

      // TEMPORARY: no email service is configured yet, so the reset link is
      // only logged server-side for now - replace this with an actual email
      // send once a mail provider is wired up.
      console.log(`Password reset link for ${email}: ${resetLink}`);
    }

    res.json({ message: genericMessage });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me - the current logged-in user's own profile, straight from the DB
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/google - redirect the browser to Google's consent screen
router.get('/google', (req, res) => {
  const url = googleClient.generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
  });
  res.redirect(url);
});

// GET /api/auth/google/callback - Google redirects back here with a temporary code
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
  }

  try {
    // Exchange the temporary code for tokens. Unlike GitHub (a plain access
    // token used to make separate REST calls for profile/email), Google's
    // token response includes a signed ID token that carries the profile
    // claims directly - verifyIdToken checks its signature against Google's
    // public keys and its audience against our own client ID, so the
    // payload can be trusted without a second API round-trip.
    const { tokens } = await googleClient.getToken(code);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name } = ticket.getPayload();

    if (!email) {
      // Every Google account has a verified email backing it (unlike
      // GitHub, where a private/unset email is possible), so this should be
      // unreachable in practice - kept as a defensive fallback rather than
      // assuming the payload shape.
      return res.redirect(`${process.env.CLIENT_URL}/login?error=google_no_email`);
    }

    // Find or create the local user, matched by googleId
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.create({
        googleId,
        memberId: await generateMemberId(),
        name: name || email,
        email,
        role: 'member',
      });
    }

    // Issue the same kind of JWT used by normal login
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('Google OAuth error:', err.response?.data || err.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
  }
});

module.exports = router;