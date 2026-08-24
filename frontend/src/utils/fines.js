// Mirrors the fine policy in backend/routes/borrowRoutes.js (FINE_RATE_PER_DAY)
// so member-facing pages can show a live estimate for a loan that's overdue
// but not yet returned - the backend only calculates and stores fineAmount
// once a book is actually returned.
const FINE_RATE_PER_DAY = 0.5;

export function isOverdue(record) {
  return !record.returnDate && new Date(record.dueDate) < new Date();
}

export function estimateFine(record) {
  if (record.returnDate) return record.fineAmount || 0;
  if (!isOverdue(record)) return 0;
  const daysLate = Math.floor((Date.now() - new Date(record.dueDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysLate > 0 ? Number((daysLate * FINE_RATE_PER_DAY).toFixed(2)) : 0;
}
