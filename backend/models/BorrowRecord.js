const mongoose = require('mongoose');

// BorrowRecord entity - our 3rd CRUD entity
// Links a User to a Book, tracks borrow/return dates
const borrowRecordSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    borrowDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    status: { type: String, enum: ['borrowed', 'returned', 'overdue'], default: 'borrowed' },
    // Calculated when a book is returned late (see FINE_RATE_PER_DAY in
    // borrowRoutes.js). The amount owed is 0 if fineWaived is true, otherwise
    // fineAmount - this field is the historical calculation either way.
    fineAmount: { type: Number, default: 0 },
    fineWaived: { type: Boolean, default: false },
    fineWaivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// This is the most heavily-queried collection in the app - indexes match the
// actual query patterns used across borrowRoutes.js/userRoutes.js/reportRoutes.js:
borrowRecordSchema.index({ member: 1 }); // a member's own borrow history
borrowRecordSchema.index({ returnDate: 1 }); // active-loan counts/guards ({returnDate: null})
borrowRecordSchema.index({ returnDate: 1, dueDate: 1 }); // overdue lookups ({returnDate: null, dueDate: {$lt: now}})
borrowRecordSchema.index({ borrowDate: 1 }); // monthly-borrows report aggregations

module.exports = mongoose.model('BorrowRecord', borrowRecordSchema);
