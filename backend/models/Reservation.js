const mongoose = require('mongoose');

// A hold placed by a member on a book that has zero available copies.
// 'pending' - waiting in the queue.
// 'ready' - a copy became available and this was the oldest pending request
//   for that book (see borrowRoutes.js PUT /:id/return) - flagged for staff
//   to act on, since there's no email service to notify the member directly.
// 'fulfilled' - the member (or staff, on their behalf) actually borrowed the
//   book, closing the reservation.
// 'cancelled' - the member or staff cancelled the hold before it was filled.
const reservationSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'ready', 'fulfilled', 'cancelled'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Queue order for a given book, and a member's own reservation list.
reservationSchema.index({ book: 1, status: 1, requestedAt: 1 });
reservationSchema.index({ member: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
