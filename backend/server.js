require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { verifyToken } = require('./middleware/auth');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const staffRoutes = require('./routes/staffRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io setup - this is what gives us the "multiple clients communicating"
// requirement from the assessment brief (real-time availability updates).
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*' },
});

// Requires the same JWT a client uses for the REST API, sent via
// socket.handshake.auth.token - verified the same way protect() verifies it
// (see verifyToken() in middleware/auth.js), so an unauthenticated or
// blocked client can't open a socket at all.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Not authorized, no token provided'));
  }

  try {
    socket.user = await verifyToken(token); // { id, role }
    next();
  } catch (err) {
    next(new Error(err.message));
  }
});

io.on('connection', (socket) => {
  // Every socket joins a personal room so member-specific events (their own
  // borrow/reservation/fine updates) can be targeted at just them instead of
  // broadcast to everyone. Staff/admin additionally join a shared room for
  // management-facing events (user blocks/deletes, role changes) that only
  // staff/admin should see live.
  socket.join(`user:${socket.user.id}`);
  if (['staff', 'admin'].includes(socket.user.role)) {
    socket.join('staff');
  }

  console.log('Client connected:', socket.id, '- user', socket.user.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Standard security headers (XSS protection, no-sniff, etc.) - applied
// before anything else touches the response. crossOriginResourcePolicy is
// relaxed from helmet's 'same-origin' default because this API and the SPA
// frontend are intentionally different origins (see the CORS setup below),
// and profile pictures under /uploads are loaded cross-origin via plain
// <img> tags - the stricter default would silently block those.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Make io accessible inside route handlers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Restricted to CLIENT_URL, matching Socket.io's CORS setup above - a wide
// open cors() let any origin call this API with credentials-free requests.
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// General API rate limit - generous enough for normal browsing/admin use,
// just a backstop against runaway/abusive clients. The stricter limit on
// POST /api/auth/login (see authRoutes.js) is what actually matters for
// credential-stuffing protection.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/audit-log', auditRoutes);

app.get('/', (req, res) => res.json({ message: 'Library System API is running' }));

// Global error-handling middleware - a backstop for anything that isn't
// already caught by a route's own try/catch (e.g. malformed JSON bodies from
// express.json(), or a synchronous throw in a handler added later without
// one). Must be registered last, after every other app.use()/route.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

const PORT = process.env.PORT || 5000;

// Only connect to DB and start listening when run directly (not during tests)
if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = { app, server, io };
