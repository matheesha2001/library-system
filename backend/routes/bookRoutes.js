const express = require('express');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/books - anyone logged in can view
router.get('/', protect, async (req, res) => {
  const books = await Book.find().sort({ createdAt: -1 });
  res.json(books);
});

// GET /api/books/:id
router.get('/:id', protect, async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: 'Book not found' });
  res.json(book);
});

// POST /api/books - admin only
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, author, isbn, totalCopies } = req.body;
    const book = await Book.create({
      title,
      author,
      isbn,
      totalCopies,
      availableCopies: totalCopies,
    });

    // Broadcast to all connected clients that the catalogue changed
    req.io.emit('bookAdded', book);

    res.status(201).json(book);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/books/:id - admin only
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });

    req.io.emit('bookUpdated', book);
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/books/:id - admin only
router.delete('/:id', protect, adminOnly, async (req, res) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json({ message: 'Book not found' });

  req.io.emit('bookDeleted', { id: req.params.id });
  res.json({ message: 'Book deleted' });
});

module.exports = router;
