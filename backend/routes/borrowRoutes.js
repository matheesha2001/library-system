const express = require('express');
const BorrowRecord = require('../models/BorrowRecord');
const Book = require('../models/Book');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const { protect, adminOnly, requireRole } = require('../middleware/auth');
const logAction = require('../utils/auditLog');

const router = express.Router();
const staffOrAdmin = requireRole('staff', 'admin');

// Placeholder fine policy - no rate configuration exists elsewhere in this
// project yet, so this is a simple flat per-day rate rather than a real
// configurable policy.
const FINE_RATE_PER_DAY = 0.5;

// How many books a single member may have out at once. Placeholder constant
// for the same reason as FINE_RATE_PER_DAY above - no configuration system
// exists yet for library-wide policy values.
const MAX_BOOKS_PER_MEMBER = 5;

function calculateFine(dueDate, returnDate) {
  const daysLate = Math.floor((returnDate.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysLate > 0 ? Number((daysLate * FINE_RATE_PER_DAY).toFixed(2)) : 0;
}

async function isAtBorrowLimit(memberId) {
  const activeCount = await BorrowRecord.countDocuments({ member: memberId, returnDate: null });
  return activeCount >= MAX_BOOKS_PER_MEMBER;
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

// A borrow (self-service or staff-issued) fulfills any reservation the
// recipient had queued for this exact book - whether they borrowed it
// themselves after seeing it become available, or staff issued it to them
// once flagged "ready" in the queue (see the return handler below).
function fulfillReservation(bookId, memberId) {
  return Reservation.findOneAndUpdate(
    { book: bookId, member: memberId, status: { $in: ['pending', 'ready'] } },
    { status: 'fulfilled' }
  );
}

// A reservation flagged "ready" is supposed to earmark the next freed-up
// copy for that specific member - without this check, availableCopies is
// just a shared pool and any other member could still claim it first,
// defeating the whole point of having been next in line. A member is only
// blocked here if someone ELSE'S ready reservation is outstanding; their own
// ready reservation (if any) always lets them straight through. This is a
// plain sequential pre-check rather than something folded into claimCopy's
// atomic update - safe because it can only ever produce an extra rejection,
// never a wrongful grant: the actual copy-claim below is still fully
// serialized through claimCopy()'s atomic $gt:0 guard.
async function isBlockedByReadyReservation(bookId, memberId) {
  const ownReadyReservation = await Reservation.exists({ book: bookId, member: memberId, status: 'ready' });
  if (ownReadyReservation) return false;

  const heldForSomeoneElse = await Reservation.exists({ book: bookId, status: 'ready', member: { $ne: memberId } });
  return Boolean(heldForSomeoneElse);
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

    if (await isAtBorrowLimit(req.user.id)) {
      return res.status(400).json({
        message: `You've reached the maximum of ${MAX_BOOKS_PER_MEMBER} borrowed books at once. Return a book before borrowing another.`,
      });
    }

    if (await isBlockedByReadyReservation(bookId, req.user.id)) {
      return res.status(400).json({
        message: 'This copy is reserved for another member whose hold is ready for pickup.',
      });
    }

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

    await fulfillReservation(bookId, req.user.id);

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

    if (await isAtBorrowLimit(memberId)) {
      return res.status(400).json({
        message: `This member already has the maximum of ${MAX_BOOKS_PER_MEMBER} borrowed books. Process a return before issuing another.`,
      });
    }

    if (await isBlockedByReadyReservation(bookId, memberId)) {
      return res.status(400).json({
        message: 'This copy is reserved for another member whose hold is ready for pickup.',
      });
    }

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

    await fulfillReservation(bookId, memberId);

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

      // A copy just became available - if anyone is waiting on this book,
      // flag the oldest pending reservation as "ready" for staff to act on.
      // There's no email service configured, so this is the notification:
      // staff see it in the reservation queue and issue the book to that
      // member directly (which then calls fulfillReservation() above).
      const nextInLine = await Reservation.findOneAndUpdate(
        { book: record.book, status: 'pending' },
        { status: 'ready' },
        { sort: { requestedAt: 1 } }
      );
      if (nextInLine) {
        req.io.emit('reservationReady', {
          id: nextInLine._id,
          book: record.book,
          member: nextInLine.member,
        });
      }
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

// PUT /api/borrow/:id/extend - extend loan due date (staff/admin). This is
// also how a member-initiated renewal request gets approved - it clears
// renewalRequested regardless of whether staff got here via the requests
// queue or just proactively extended someone's loan.
router.put('/:id/extend', protect, staffOrAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const daysNum = Number(days);
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({ message: 'days must be a whole number between 1 and 30' });
    }

    const record = await BorrowRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.returnDate) {
      return res.status(400).json({ message: 'Cannot extend a returned book' });
    }

    const currentDue = new Date(record.dueDate || Date.now());
    currentDue.setDate(currentDue.getDate() + daysNum);
    record.dueDate = currentDue;
    record.renewalRequested = false;
    await record.save();

    req.io.emit('borrowUpdated', record);

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/borrow/:id/request-renewal - member asks for more time on their
// own active loan. Staff decide the actual extension via PUT /:id/extend
// (approve) or PUT /:id/deny-renewal (deny).
router.put('/:id/request-renewal', protect, async (req, res) => {
  try {
    const record = await BorrowRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (!['admin', 'staff'].includes(req.user.role) && record.member.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this record' });
    }
    if (record.returnDate) {
      return res.status(400).json({ message: 'Cannot request a renewal for a returned book' });
    }

    // Atomically flip renewalRequested only if it's still false - the same
    // check-and-set-in-one-query pattern as claimCopy() above, so two
    // concurrent renewal requests on the same record can't both pass the
    // "not already pending" check before either one writes.
    const updated = await BorrowRecord.findOneAndUpdate(
      { _id: req.params.id, renewalRequested: false },
      { renewalRequested: true, renewalRequestedAt: new Date() },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'A renewal request is already pending for this loan' });
    }

    req.io.emit('borrowUpdated', updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/borrow/:id/deny-renewal - staff/admin dismiss a pending renewal
// request without granting more time.
router.put('/:id/deny-renewal', protect, staffOrAdmin, async (req, res) => {
  try {
    const record = await BorrowRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (!record.renewalRequested) {
      return res.status(400).json({ message: 'This loan has no pending renewal request' });
    }

    record.renewalRequested = false;
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

    await logAction(req.user.id, 'borrow.delete', 'BorrowRecord', record._id, {
      book: record.book,
      member: record.member,
    });

    req.io.emit('borrowDeleted', { id: req.params.id });

    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
