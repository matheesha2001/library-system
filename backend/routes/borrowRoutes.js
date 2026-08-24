const express = require('express');
const BorrowRecord = require('../models/BorrowRecord');
const Book = require('../models/Book');
const User = require('../models/User');
const { protect, adminOnly, requireRole } = require('../middleware/auth');

const router = express.Router();
const staffOrAdmin = requireRole('staff', 'admin');

// Placeholder fine policy - no rate configuration exists elsewhere in this
// project yet, so this is a simple flat per-day rate rather than a real
// configurable policy.
const FINE_RATE_PER_DAY = 0.5;

function calculateFine(dueDate, returnDate) {
  const daysLate = Math.floor((returnDate.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysLate > 0 ? Number((daysLate * FINE_RATE_PER_DAY).toFixed(2)) : 0;
}

// Atomically claim one copy of a book: the $gt: 0 condition is checked and
// the decrement applied in the same database operation, so two concurrent
// requests for the last remaining copy can't both read availableCopies=1 and
// both succeed (the previous `book.availableCopies -= 1; await book.save()`
// pattern was vulnerable to exactly that race). Returns null if the book
// doesn't exist or has no copies available.
function claimCopy(bookId) {
  return Book.findOneAndUpdate(
    { _id: bookId, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );
}

// Atomically release one copy back to the shelf, guarded the same way on the
// other end (can't push availableCopies above totalCopies). $expr is needed
// here since the guard compares two fields on the same document.
function releaseCopy(bookId) {
  return Book.findOneAndUpdate(
    { _id: bookId, $expr: { $lt: ['$availableCopies', '$totalCopies'] } },
    { $inc: { availableCopies: 1 } },
    { new: true }
  );
}

// GET /api/borrow - staff/admin see all, member sees only their own
router.get('/', protect, async (req, res) => {
  try {
    const filter = ['admin', 'staff'].includes(req.user.role) ? {} : { member: req.user.id };
    const records = await BorrowRecord.find(filter)
      .populate('book', 'title author')
      .populate('member', 'name email memberId studentId')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/borrow - a member borrows a book for themselves
router.post('/', protect, async (req, res) => {
  try {
    const { bookId, dueDate } = req.body;

    const book = await claimCopy(bookId);
    if (!book) {
      const exists = await Book.exists({ _id: bookId });
      return res.status(exists ? 400 : 404).json({
        message: exists ? 'No copies available right now' : 'Book not found',
      });
    }

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

// POST /api/borrow/issue - staff/admin issue a book to a specific member
// (the front-desk equivalent of POST /, where the librarian picks the member)
router.post('/issue', protect, staffOrAdmin, async (req, res) => {
  try {
    const { bookId, memberId, dueDate } = req.body;

    if (!bookId || !memberId || !dueDate) {
      return res.status(400).json({ message: 'bookId, memberId and dueDate are required' });
    }

    const member = await User.findById(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const book = await claimCopy(bookId);
    if (!book) {
      const exists = await Book.exists({ _id: bookId });
      return res.status(exists ? 400 : 404).json({
        message: exists ? 'No copies available right now' : 'Book not found',
      });
    }

    const record = await BorrowRecord.create({
      book: bookId,
      member: memberId,
      dueDate,
    });
    await record.populate('book', 'title author');
    await record.populate('member', 'name email memberId studentId');

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

    // Members can only return their own borrowed books; staff/admin can return any
    if (!['admin', 'staff'].includes(req.user.role) && record.member.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this record' });
    }

    record.status = 'returned';
    record.returnDate = new Date();
    record.fineAmount = calculateFine(record.dueDate, record.returnDate);
    await record.save();

    // If this somehow returns null (the book's copy count is already at
    // totalCopies - shouldn't happen in normal operation), the loan is still
    // correctly marked returned above; there's just no copy-count change to
    // broadcast.
    const book = await releaseCopy(record.book);
    if (book) {
      req.io.emit('availabilityChanged', {
        bookId: book._id,
        availableCopies: book.availableCopies,
      });
    }
    req.io.emit('borrowUpdated', record);

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/borrow/:id/waive-fine - staff/admin waive a calculated overdue fine
router.put('/:id/waive-fine', protect, staffOrAdmin, async (req, res) => {
  try {
    const record = await BorrowRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.fineAmount <= 0) {
      return res.status(400).json({ message: 'This record has no fine to waive' });
    }

    record.fineWaived = true;
    record.fineWaivedBy = req.user.id;
    await record.save();

    req.io.emit('borrowUpdated', record);

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/borrow/:id/extend - extend loan due date (staff/admin)
router.put('/:id/extend', protect, staffOrAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const record = await BorrowRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.returnDate) {
      return res.status(400).json({ message: 'Cannot extend a returned book' });
    }

    const currentDue = new Date(record.dueDate || Date.now());
    currentDue.setDate(currentDue.getDate() + Number(days));
    record.dueDate = currentDue;
    await record.save();

    req.io.emit('borrowUpdated', record);

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/borrow/:id - admin only (e.g. remove erroneous record)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const record = await BorrowRecord.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    req.io.emit('borrowDeleted', { id: req.params.id });

    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
