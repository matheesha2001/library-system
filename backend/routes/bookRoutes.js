const express = require('express');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');
const { protect, requireRole } = require('../middleware/auth');
const logAction = require('../utils/auditLog');

const router = express.Router();
const staffOrAdmin = requireRole('staff', 'admin');

// Maps a malformed :id (CastError) or a failed schema validator
// (ValidationError, e.g. a negative totalCopies) to a clean 400 instead of
// falling through to the generic 500 below - a bad request shouldn't look
// like a server crash.
function handleError(err, res) {
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid book ID' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  return res.status(500).json({ message: 'Server error', error: err.message });
}

// GET /api/books - anyone logged in can view
//
// Without page/limit/search/availability params, returns the full catalogue
// as a plain array - unchanged legacy behavior, relied on by the CSV export
// on the Reports page. Passing any of those switches to paginated mode and
// returns { books, total, page, limit, totalPages } instead.
router.get('/', protect, async (req, res) => {
  try {
    const { page, limit, search, availability } = req.query;
    const paginated = page !== undefined || limit !== undefined || search !== undefined || availability !== undefined;

    if (!paginated) {
      const books = await Book.find().sort({ createdAt: -1 }).populate('category', 'name');
      return res.json(books);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));

    const query = {};
    if (search) {
      // Escape regex metacharacters in user input before building the
      // RegExp - an unescaped search term here would be the same
      // unbounded-backtracking risk flagged elsewhere in this app.
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ title: regex }, { author: regex }, { isbn: regex }];
    }
    if (availability === 'available') query.availableCopies = { $gt: 0 };
    else if (availability === 'out') query.availableCopies = 0;

    const [books, total] = await Promise.all([
      // _id is a required tiebreaker: this catalogue has thousands of books
      // sharing the exact same createdAt (bulk-seeded in one instant), and
      // skip/limit pagination is only correct with a fully deterministic
      // sort - without a unique tiebreaker, the same book can be returned on
      // more than one page (or skipped entirely) since Mongo doesn't
      // guarantee a stable order among tied sort keys across separate calls.
      Book.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('category', 'name'),
      Book.countDocuments(query),
    ]);

    res.json({
      books,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/books/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate('category', 'name');
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/books - staff or admin
router.post('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const { title, author, isbn, category, totalCopies } = req.body;

    const existingIsbn = await Book.findOne({ isbn });
    if (existingIsbn) {
      return res.status(400).json({ message: 'A book with that ISBN already exists' });
    }

    const book = await Book.create({
      title,
      author,
      isbn,
      category: category || undefined,
      totalCopies,
      availableCopies: totalCopies,
    });
    await book.populate('category', 'name');

    // Broadcast to all connected clients that the catalogue changed
    req.io.emit('bookAdded', book);

    res.status(201).json(book);
  } catch (err) {
    handleError(err, res);
  }
});

// PUT /api/books/:id - staff or admin (also used for stock/copy adjustments)
router.put('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.category === '') update.category = null;

    const existing = await Book.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Book not found' });

    // Schema-level min/integer validators (enforced below via runValidators)
    // cover each field on its own, but "availableCopies <= totalCopies" is a
    // cross-field rule that has to be checked here, against whichever of the
    // two values isn't part of this particular update.
    const nextTotalCopies = update.totalCopies !== undefined ? update.totalCopies : existing.totalCopies;
    const nextAvailableCopies = update.availableCopies !== undefined ? update.availableCopies : existing.availableCopies;
    if (nextAvailableCopies > nextTotalCopies) {
      return res.status(400).json({ message: 'availableCopies cannot exceed totalCopies' });
    }

    const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate('category', 'name');

    req.io.emit('bookUpdated', book);
    res.json(book);
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/books/:id - staff or admin
router.delete('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    // Same protective pattern as category and user deletion: block deletion
    // while any copy of this book is still out on loan, so BorrowRecord.book
    // never ends up pointing at a deleted document.
    const activeBorrows = await BorrowRecord.countDocuments({
      book: req.params.id,
      returnDate: null,
    });
    if (activeBorrows > 0) {
      return res.status(400).json({
        message: `Cannot delete this book - ${activeBorrows} unreturned copy(ies) still on loan. Please process returns first.`,
      });
    }

    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    await logAction(req.user.id, 'book.delete', 'Book', book._id, {
      title: book.title,
      isbn: book.isbn,
    });

    req.io.emit('bookDeleted', { id: req.params.id });
    res.json({ message: 'Book deleted' });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
