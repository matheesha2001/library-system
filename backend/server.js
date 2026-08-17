require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const borrowRoutes = require('./routes/borrowRoutes');

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

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrow', borrowRoutes);

app.get('/', (req, res) => res.json({ message: 'Library System API is running' }));

const PORT = process.env.PORT || 5000;

// Only connect to DB and start listening when run directly (not during tests)
if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = { app, server, io };
