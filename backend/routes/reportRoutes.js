const express = require('express');
const mongoose = require('mongoose');
const BorrowRecord = require('../models/BorrowRecord');
const Book = require('../models/Book');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();
const staffOrAdmin = requireRole('staff', 'admin');

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Builds a 12-entry scaffold {year, month, label, count: 0} covering the
// rolling window ending this month, so the chart always shows a continuous
// 12-bar timeline instead of gaps for months with no borrow activity.
function buildTwelveMonthScaffold() {
  const scaffold = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() - 11);

  for (let i = 0; i < 12; i++) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1; // 1-12, matching Mongo's $month
    scaffold.push({ year, month, label: `${MONTH_LABELS[month - 1]} ${year}`, count: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return scaffold;
}

function windowStart() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 11);
  return start;
}

// Merges aggregation results ({_id: {year, month}, count}) onto a 12-month scaffold
function mergeIntoScaffold(results) {
  const scaffold = buildTwelveMonthScaffold();
  const byKey = new Map(scaffold.map((entry) => [`${entry.year}-${entry.month}`, entry]));

  results.forEach((r) => {
    const key = `${r._id.year}-${r._id.month}`;
    const entry = byKey.get(key);
    if (entry) entry.count = r.count;
  });

  return scaffold;
}

// GET /api/reports/monthly-borrows - staff or admin, aggregate across all members,
// plus a per-user breakdown, grouped by borrowDate (last 12 months)
router.get('/monthly-borrows', protect, staffOrAdmin, async (req, res) => {
  try {
    const start = windowStart();

    const overall = await BorrowRecord.aggregate([
      { $match: { borrowDate: { $gte: start } } },
      {
        $group: {
          _id: { year: { $year: '$borrowDate' }, month: { $month: '$borrowDate' } },
          count: { $sum: 1 },
        },
      },
    ]);

    const byUserRaw = await BorrowRecord.aggregate([
      { $match: { borrowDate: { $gte: start } } },
      {
        $group: {
          _id: {
            member: '$member',
            year: { $year: '$borrowDate' },
            month: { $month: '$borrowDate' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.member',
          foreignField: '_id',
          as: 'memberInfo',
        },
      },
      { $unwind: '$memberInfo' },
    ]);

    // Reshape the flat per-user-per-month rows into one scaffold per user
    const byUserMap = new Map();
    byUserRaw.forEach((row) => {
      const memberId = String(row._id.member);
      if (!byUserMap.has(memberId)) {
        byUserMap.set(memberId, {
          member: { id: memberId, name: row.memberInfo.name },
          monthly: buildTwelveMonthScaffold(),
        });
      }
      const entry = byUserMap.get(memberId);
      const scaffoldEntry = entry.monthly.find(
        (m) => m.year === row._id.year && m.month === row._id.month
      );
      if (scaffoldEntry) scaffoldEntry.count = row.count;
    });

    res.json({
      monthly: mergeIntoScaffold(overall),
      byUser: Array.from(byUserMap.values()),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reports/monthly-borrows/me - the current user's own monthly borrow counts
router.get('/monthly-borrows/me', protect, async (req, res) => {
  try {
    const start = windowStart();

    const results = await BorrowRecord.aggregate([
      { $match: { member: new mongoose.Types.ObjectId(req.user.id), borrowDate: { $gte: start } } },
      {
        $group: {
          _id: { year: { $year: '$borrowDate' }, month: { $month: '$borrowDate' } },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ monthly: mergeIntoScaffold(results) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reports/top-books - staff or admin, top borrowed books
router.get('/top-books', protect, staffOrAdmin, async (req, res) => {
  try {
    const topBooks = await BorrowRecord.aggregate([
      { $group: { _id: '$book', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'bookDetails',
        },
      },
      { $unwind: '$bookDetails' },
      {
        $project: {
          _id: '$bookDetails._id',
          title: '$bookDetails.title',
          author: '$bookDetails.author',
          isbn: '$bookDetails.isbn',
          totalCopies: '$bookDetails.totalCopies',
          availableCopies: '$bookDetails.availableCopies',
          borrowCount: '$count',
        },
      },
    ]);

    res.json(topBooks);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reports/overdue-list - staff or admin, detailed overdue loans
router.get('/overdue-list', protect, staffOrAdmin, async (req, res) => {
  try {
    const overdueList = await BorrowRecord.find({
      returnDate: null,
      dueDate: { $lt: new Date() },
    })
      .populate('book', 'title author isbn')
      .populate('member', 'name email memberId studentId')
      .sort({ dueDate: 1 });

    res.json(overdueList);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reports/admin-stats - staff or admin, top-line counts for the admin dashboard
router.get('/admin-stats', protect, staffOrAdmin, async (req, res) => {
  try {
    const [totalBooks, totalUsers, activeLoans, totalReturned, overdueCount] = await Promise.all([
      Book.countDocuments(),
      User.countDocuments(),
      BorrowRecord.countDocuments({ returnDate: null }),
      BorrowRecord.countDocuments({ returnDate: { $ne: null } }),
      BorrowRecord.countDocuments({ returnDate: null, dueDate: { $lt: new Date() } }),
    ]);

    res.json({
      totalBooks,
      totalUsers,
      activeLoans,
      totalReturned,
      pendingRequests: 0,
      overdueCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
