const express = require('express');
const BorrowRecord = require('../models/BorrowRecord');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/borrow - admin sees all, member sees only their own
router.get('/', protect, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { member: req.user.id };
  const records = await BorrowRecord.find(filter)
    .populate('book', 'title author')
    .populate('member', 'name email')
    .sort({ createdAt: -1 });
  res.json(records);
});

// POST /api/borrow - a member borrows a book
router.post('/', protect, async (req, res) => {
  try {
    const { bookId, dueDate } = req.body;

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.availableCopies < 1) {
      return res.status(400).json({ message: 'No copies available right now' });
    }

    book.availableCopies -= 1;
    await book.save();

    const record = await BorrowRecord.create({
      book: bookId,
      member: req.user.id,
      dueDate,
    });

    // This is the key real-time feature: every connected client (e.g. other
    // members browsing the catalogue) instantly sees the updated copy count.
    req.io.emit('availabilityChanged', {
      bookId: book._id,
      availableCopies: book.availableCopies,
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/borrow/:id/return - mark a book as returned
router.put('/:id/return', protect, async (req, res) => {
  try {
    const record = await BorrowRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Members can only return their own borrowed books; admins can return any
    if (req.user.role !== 'admin' && record.member.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this record' });
    }

    record.status = 'returned';
    record.returnDate = new Date();
    await record.save();

    const book = await Book.findById(record.book);
    book.availableCopies += 1;
    await book.save();

    req.io.emit('availabilityChanged', {
      bookId: book._id,
      availableCopies: book.availableCopies,
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/borrow/:id - admin only (e.g. remove erroneous record)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  const record = await BorrowRecord.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ message: 'Record not found' });
  res.json({ message: 'Record deleted' });
});

module.exports = router;
