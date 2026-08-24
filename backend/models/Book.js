const mongoose = require('mongoose');

// Book entity schema
const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    coverImage: { type: String, trim: true },
    description: { type: String, trim: true },
    totalCopies: {
      type: Number,
      required: true,
      default: 1,
      min: [0, 'totalCopies cannot be negative'],
      validate: { validator: Number.isInteger, message: 'totalCopies must be an integer' },
    },
    availableCopies: {
      type: Number,
      required: true,
      default: 1,
      min: [0, 'availableCopies cannot be negative'],
      validate: { validator: Number.isInteger, message: 'availableCopies must be an integer' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
