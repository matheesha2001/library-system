const mongoose = require('mongoose');

// Book entity - our 2nd CRUD entity
const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true },
    totalCopies: { type: Number, required: true, default: 1 },
    availableCopies: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
