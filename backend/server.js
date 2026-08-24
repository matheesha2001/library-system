require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const staffRoutes = require('./routes/staffRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io setup - this is what gives us the "multiple clients communicating"
// requirement from the assessment brief (real-time availability updates).
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*' },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Make io accessible inside route handlers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors());
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
