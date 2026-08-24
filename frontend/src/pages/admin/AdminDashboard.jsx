import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import AdminLayout from './AdminLayout';
import MonthlyBorrowChart from '../../components/MonthlyBorrowChart';

const STAT_CARDS = [
  { key: 'totalBooks', label: 'Total Books', icon: 'library_books', borderClass: 'border-l-[#378ADD]', iconClass: 'text-[#0C447C] dark:text-[#85B7EB]' },
  { key: 'totalUsers', label: 'Registered Users', icon: 'group', borderClass: 'border-l-[#7F77DD]', iconClass: 'text-[#3C3489] dark:text-[#A8A2F0]' },
  { key: 'activeLoans', label: 'Active Loans', icon: 'auto_stories', borderClass: 'border-l-[#5DCAA5]', iconClass: 'text-[#085041] dark:text-[#8EE4C9]' },
  { key: 'overdueCount', label: 'Overdue Books', icon: 'warning', borderClass: 'border-l-[#F0997B]', iconClass: 'text-[#712B13] dark:text-[#F7C6B5]' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [topBooks, setTopBooks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [statsRes, topBooksRes] = await Promise.all([
          api.get('/reports/admin-stats'),
          api.get('/reports/top-books'),
        ]);
        if (!cancelled) {
          setStats(statsRes.data);
          setTopBooks(topBooksRes.data);
        }
      } catch (err) {
        if (!cancelled) setError('Could not load admin metrics');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Admin Overview
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              Real-time statistics, active borrowing metrics, and catalogue management.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/books"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary dark:bg-sky-600 text-on-primary font-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Book
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-4 py-3 font-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {stats?.overdueCount > 0 && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-error-container/40 dark:bg-rose-950/40 border border-error/30 dark:border-rose-800/50 text-on-surface dark:text-slate-100">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-error dark:text-rose-400">warning</span>
              <div>
                <p className="font-label-lg text-error dark:text-rose-400 font-semibold">
                  {stats.overdueCount} Overdue {stats.overdueCount === 1 ? 'Book' : 'Books'}
                </p>
                <p className="font-body-sm text-on-surface-variant dark:text-slate-400">
                  There are unreturned books past their scheduled due date.
                </p>
              </div>
            </div>
            <Link
              to="/admin/borrows?filter=overdue"
              className="px-3 py-1.5 bg-error dark:bg-rose-600 text-on-error font-label-sm text-xs rounded-md hover:bg-error/90 dark:hover:bg-rose-500 transition-colors shrink-0"
            >
              View Overdue Records
            </Link>
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => (
            <div
              key={card.key}
              className={`bg-surface dark:bg-slate-800 rounded-xl p-5 border border-outline-variant dark:border-slate-700 border-l-4 ${card.borderClass} shadow-sm flex flex-col justify-between`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">
                  {card.label}
                </span>
                <span className={`material-symbols-outlined text-[20px] ${card.iconClass}`}>
                  {card.icon}
                </span>
              </div>
              <div className={`font-headline-lg text-headline-lg font-semibold ${stats ? 'text-on-surface dark:text-slate-100' : 'text-on-surface-variant dark:text-slate-500'}`}>
                {stats ? stats[card.key] ?? 0 : '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/admin/books"
            className="p-4 rounded-xl border border-outline-variant dark:border-slate-700 bg-surface dark:bg-slate-800 hover:bg-surface-variant/40 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4"
          >
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[#E6F1FB] dark:bg-[#185FA5]/25 text-[#185FA5] dark:text-[#85B7EB] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">menu_book</span>
            </div>
            <div>
              <h3 className="font-label-lg text-on-surface dark:text-slate-100 font-semibold">Manage Books</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs">Add, edit, adjust stock</p>
            </div>
          </Link>
          <Link
            to="/admin/users"
            className="p-4 rounded-xl border border-outline-variant dark:border-slate-700 bg-surface dark:bg-slate-800 hover:bg-surface-variant/40 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4"
          >
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[#EEEDFE] dark:bg-[#534AB7]/25 text-[#534AB7] dark:text-[#A8A2F0] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">group</span>
            </div>
            <div>
              <h3 className="font-label-lg text-on-surface dark:text-slate-100 font-semibold">Manage Users</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs">View members & roles</p>
            </div>
          </Link>
          <Link
            to="/admin/borrows"
            className="p-4 rounded-xl border border-outline-variant dark:border-slate-700 bg-surface dark:bg-slate-800 hover:bg-surface-variant/40 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4"
          >
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[#E1F5EE] dark:bg-[#0F6E56]/25 text-[#0F6E56] dark:text-[#8EE4C9] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">handshake</span>
            </div>
            <div>
              <h3 className="font-label-lg text-on-surface dark:text-slate-100 font-semibold">Manage Borrows</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs">Returns & extensions</p>
            </div>
          </Link>
          <Link
            to="/admin/reports"
            className="p-4 rounded-xl border border-outline-variant dark:border-slate-700 bg-surface dark:bg-slate-800 hover:bg-surface-variant/40 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4"
          >
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[#FAECE7] dark:bg-[#993C1D]/25 text-[#993C1D] dark:text-[#F7C6B5] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">assessment</span>
            </div>
            <div>
              <h3 className="font-label-lg text-on-surface dark:text-slate-100 font-semibold">Reports & CSV</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs">Analytics & data export</p>
            </div>
          </Link>
        </div>

        {/* Charts & Popular Books Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MonthlyBorrowChart endpoint="/reports/monthly-borrows" title="Library-Wide Monthly Borrowing Activity" />
          </div>

          <div className="bg-surface dark:bg-slate-800 rounded-xl p-5 border border-outline-variant dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100 mb-1">Most Borrowed Books</h2>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 mb-4 text-xs">Top requested titles overall</p>

              {topBooks.length === 0 ? (
                <p className="font-body-md text-on-surface-variant dark:text-slate-400 text-sm py-4">No borrowing activity recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {topBooks.map((book, i) => (
                    <div key={book._id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-slate-900/60 border border-outline-variant/50 dark:border-slate-700/60">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="font-headline-sm text-sm font-bold text-primary dark:text-sky-400 w-5 text-center">
                          #{i + 1}
                        </span>
                        <div className="truncate">
                          <p className="font-label-md text-on-surface dark:text-slate-100 font-semibold truncate">{book.title}</p>
                          <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs truncate">by {book.author}</p>
                        </div>
                      </div>
                      <span className="font-label-sm text-xs px-2.5 py-1 rounded-full bg-primary/10 dark:bg-sky-900/50 text-primary dark:text-sky-300 font-semibold shrink-0">
                        {book.borrowCount} {book.borrowCount === 1 ? 'borrow' : 'borrows'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/admin/reports"
              className="mt-4 font-label-md text-xs text-primary dark:text-sky-400 hover:underline flex items-center justify-end gap-1"
            >
              View detailed reports
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
