import { useEffect, useState } from 'react';
import api from '../../api/client';
import AdminLayout from './AdminLayout';
import MonthlyBorrowChart from '../../components/MonthlyBorrowChart';

export default function AdminReports() {
  const [topBooks, setTopBooks] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [topRes, overdueRes] = await Promise.all([
        api.get('/reports/top-books'),
        api.get('/reports/overdue-list'),
      ]);

      setTopBooks(topRes.data);
      setOverdueList(overdueRes.data);
      setError('');
    } catch (err) {
      setError('Could not load report analytics.');
    }
  }

  // Export functions to generate CSV files dynamically in browser
  async function exportBooksCSV() {
    try {
      const res = await api.get('/books');
      const books = res.data;
      const headers = ['ID', 'Title', 'Author', 'ISBN', 'Total Copies', 'Available Copies'];
      const rows = books.map((b) => [
        b._id,
        `"${b.title.replace(/"/g, '""')}"`,
        `"${b.author.replace(/"/g, '""')}"`,
        `"${b.isbn}"`,
        b.totalCopies,
        b.availableCopies,
      ]);

      downloadCSV('library_books_report.csv', [headers, ...rows]);
    } catch (err) {
      setError('Failed to export books CSV.');
    }
  }

  async function exportUsersCSV() {
    try {
      const res = await api.get('/users');
      const users = res.data;
      const headers = ['ID', 'Name', 'Email', 'Member ID', 'Student ID', 'Role', 'Active Borrows'];
      const rows = users.map((u) => [
        u._id,
        `"${u.name.replace(/"/g, '""')}"`,
        `"${u.email}"`,
        `"${u.memberId || ''}"`,
        `"${u.studentId || ''}"`,
        u.role,
        u.activeBorrowsCount || 0,
      ]);

      downloadCSV('library_users_report.csv', [headers, ...rows]);
    } catch (err) {
      setError('Failed to export users CSV.');
    }
  }

  async function exportBorrowsCSV() {
    try {
      const res = await api.get('/borrow');
      const borrows = res.data;
      const headers = ['ID', 'Book Title', 'Borrower Name', 'Borrower Email', 'Borrow Date', 'Due Date', 'Return Date', 'Status'];
      const rows = borrows.map((r) => {
        const isReturned = !!r.returnDate;
        const isOverdue = !isReturned && new Date(r.dueDate) < new Date();
        const status = isReturned ? 'Returned' : isOverdue ? 'Overdue' : 'Active';

        return [
          r._id,
          `"${(r.book?.title || '').replace(/"/g, '""')}"`,
          `"${(r.member?.name || '').replace(/"/g, '""')}"`,
          `"${r.member?.email || ''}"`,
          new Date(r.borrowDate).toISOString().split('T')[0],
          new Date(r.dueDate).toISOString().split('T')[0],
          r.returnDate ? new Date(r.returnDate).toISOString().split('T')[0] : '',
          status,
        ];
      });

      downloadCSV('library_borrows_report.csv', [headers, ...rows]);
    } catch (err) {
      setError('Failed to export borrow log CSV.');
    }
  }

  function downloadCSV(filename, data) {
    const csvContent = data.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Reports & Analytics Hub
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              Analyze circulation trends, track overdue risks, and export data.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-4 py-3 font-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {/* Data Export Banner */}
        <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary dark:text-sky-400">download</span>
              Export Library Data
            </h2>
            <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mt-1">
              Download clean CSV spreadsheets for reporting, auditing, or backup.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportBooksCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 hover:bg-surface-variant/50 dark:hover:bg-slate-700 font-label-md text-xs text-on-surface dark:text-slate-200 rounded-lg transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-sm text-primary dark:text-sky-400">menu_book</span>
              Export Books CSV
            </button>
            <button
              onClick={exportUsersCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 hover:bg-surface-variant/50 dark:hover:bg-slate-700 font-label-md text-xs text-on-surface dark:text-slate-200 rounded-lg transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-sm text-secondary dark:text-purple-400">group</span>
              Export Users CSV
            </button>
            <button
              onClick={exportBorrowsCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 hover:bg-surface-variant/50 dark:hover:bg-slate-700 font-label-md text-xs text-on-surface dark:text-slate-200 rounded-lg transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-sm text-tertiary dark:text-amber-400">receipt_long</span>
              Export Borrow Log CSV
            </button>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MonthlyBorrowChart endpoint="/reports/monthly-borrows" title="Monthly Borrowing Circulation" />
          </div>

          <div className="bg-surface dark:bg-slate-800 rounded-xl p-5 border border-outline-variant dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100 mb-1">Top Requested Books</h2>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 mb-4 text-xs">Most borrowed items in catalogue</p>

              {topBooks.length === 0 ? (
                <p className="font-body-md text-on-surface-variant dark:text-slate-400 text-sm py-4">No borrow records found.</p>
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
                      <span className="font-label-sm text-xs px-2.5 py-1 rounded-full bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-300 font-semibold shrink-0">
                        {book.borrowCount} borrows
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Overdue Loans Table */}
        <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 p-5 shadow-sm">
          <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100 mb-1">Current Overdue Loans</h2>
          <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-4">
            Items currently past due date needing return action
          </p>

          {overdueList.length === 0 ? (
            <p className="text-center py-6 text-on-surface-variant dark:text-slate-400 text-sm bg-surface-container-low dark:bg-slate-900 rounded-lg border border-outline-variant/40 dark:border-slate-700/60">
              🎉 Excellent! No overdue books at this time.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-900/80 border-b border-outline-variant dark:border-slate-700 font-label-md text-xs text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3 px-4">Book Title</th>
                    <th className="py-3 px-4">Borrower</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Overdue Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-slate-700/60 font-body-md text-sm text-on-surface dark:text-slate-100">
                  {overdueList.map((r) => {
                    const daysOverdue = Math.max(
                      1,
                      Math.floor((new Date() - new Date(r.dueDate)) / (1000 * 60 * 60 * 24))
                    );

                    return (
                      <tr key={r._id} className="hover:bg-surface-variant/30 dark:hover:bg-slate-700/40">
                        <td className="py-3 px-4 font-semibold text-on-surface dark:text-slate-100">
                          {r.book?.title || 'Unknown Title'}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-label-md text-on-surface dark:text-slate-100">{r.member?.name}</p>
                          <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">{r.member?.email}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-error dark:text-rose-400 font-semibold">
                          {new Date(r.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-label-sm text-xs px-2.5 py-1 rounded-full bg-error/15 dark:bg-rose-950/60 text-error dark:text-rose-300 font-semibold">
                            {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
