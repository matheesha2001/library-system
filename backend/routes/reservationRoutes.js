const express = require('express');
const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();
const staffOrAdmin = requireRole('staff', 'admin');

// POST /api/reservations - a member places a hold on a book that's fully
// checked out (the alternative to a disabled Borrow button on the catalogue)
router.post('/', protect, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ message: 'bookId is required' });

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.availableCopies > 0) {
      return res.status(400).json({ message: 'This book is currently available - just borrow it directly.' });
    }

    const existing = await Reservation.findOne({
      book: bookId,
      member: req.user.id,
      status: { $in: ['pending', 'ready'] },
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have an active reservation for this book.' });
    }

    const reservation = await Reservation.create({ book: bookId, member: req.user.id });
    await reservation.populate('book', 'title author');

    req.io.emit('reservationCreated', reservation);

    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reservations/me - the current member's own reservations
router.get('/me', protect, async (req, res) => {
  try {
    const reservations = await Reservation.find({ member: req.user.id })
      .populate('book', 'title author')
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reservations/book/:bookId - staff/admin view of a single book's
// queue, oldest request first
router.get('/book/:bookId', protect, staffOrAdmin, async (req, res) => {
  try {
    const reservations = await Reservation.find({
      book: req.params.bookId,
      status: { $in: ['pending', 'ready'] },
    })
      .populate('member', 'name email memberId')
      .sort({ requestedAt: 1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/reservations/:id/cancel - the member who placed it, or staff/admin
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

    if (!['admin', 'staff'].includes(req.user.role) && reservation.member.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to cancel this reservation' });
    }
    if (!['pending', 'ready'].includes(reservation.status)) {
      return res.status(400).json({ message: 'This reservation is no longer active' });
    }

    reservation.status = 'cancelled';
    await reservation.save();

    req.io.emit('reservationCancelled', { id: reservation._id, book: reservation.book });

    res.json(reservation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
