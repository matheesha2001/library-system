const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Book = require('../../models/Book');

let seq = 0;
function nextSeq() {
  seq += 1;
  return seq;
}

// Creates a user directly against the model (bypassing the register/staff
// routes) so tests can set up fixtures - blocked users, staff, admins - that
// those public routes wouldn't otherwise let you create.
async function createUser({ role = 'member', isBlocked = false, rawPassword = 'password123', ...overrides } = {}) {
  const n = nextSeq();
  const hashed = await bcrypt.hash(rawPassword, 10);
  const user = await User.create({
    name: overrides.name || `Test User ${n}`,
    memberId: overrides.memberId || `TESTID${n}`,
    email: overrides.email || `testuser${n}@example.com`,
    password: hashed,
    role,
    isBlocked,
  });
  return { user, rawPassword };
}

// Signs the same shape of JWT as POST /api/auth/login, without going through
// the login rate limiter.
function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function createBook(overrides = {}) {
  const n = nextSeq();
  const totalCopies = overrides.totalCopies ?? 1;
  return Book.create({
    title: overrides.title || `Test Book ${n}`,
    author: overrides.author || 'Test Author',
    isbn: overrides.isbn || `TEST-ISBN-${n}`,
    totalCopies,
    availableCopies: overrides.availableCopies ?? totalCopies,
  });
}

module.exports = { createUser, signToken, createBook };
