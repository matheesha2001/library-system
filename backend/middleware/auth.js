const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies a JWT and re-checks isBlocked - shared by protect() below (HTTP)
// and the Socket.io auth middleware in server.js, so a socket connection is
// authenticated exactly the same way an HTTP request is. Throws on any
// failure; the two custom error codes let callers distinguish "no such user"
// / "blocked" from a plain invalid/expired token without parsing messages.
async function verifyToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // A valid JWT only proves who signed in, not whether that account is
  // still allowed access - without re-checking isBlocked here, a blocked
  // user's existing token would keep working normally for up to its full
  // 7-day lifetime, defeating the block entirely.
  const currentUser = await User.findById(decoded.id).select('isBlocked');
  if (!currentUser) {
    const err = new Error('Not authorized, user no longer exists');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  if (currentUser.isBlocked) {
    const err = new Error('This account has been blocked. Please contact library staff.');
    err.code = 'USER_BLOCKED';
    throw err;
  }

  return decoded; // { id, role }
}

// Verifies the JWT sent in the Authorization header (format: "Bearer <token>")
async function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = await verifyToken(token); // identity/role come from the verified JWT
    next();
  } catch (err) {
    if (err.code === 'USER_BLOCKED') {
      return res.status(403).json({ message: err.message });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(401).json({ message: err.message });
    }
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
}

// Restricts a route to admins only. Use AFTER protect().
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
}

// Restricts a route to any of the given roles, e.g. requireRole('staff', 'admin').
// Use AFTER protect().
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: `Requires one of these roles: ${roles.join(', ')}` });
  };
}

module.exports = { protect, adminOnly, requireRole, verifyToken };
