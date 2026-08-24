import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import socket from '../../api/socket';
import AdminLayout from './AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14); // matches the 2-week loan period used elsewhere
  return d.toISOString().slice(0, 10);
}

export default function AdminBorrows() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter);

  // Extend Modal State
  const [extendRecord, setExtendRecord] = useState(null);
  const [extendDays, setExtendDays] = useState(7);

  // Delete Modal State
  const [deleteRecord, setDeleteRecord] = useState(null);

  // Issue Book Modal State
  const [books, setBooks] = useState([]);
  const [bookSearch, setBookSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ bookId: '', memberId: '', dueDate: defaultDueDate() });
  const [issueError, setIssueError] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  useEffect(() => {
    fetchBorrows();
    fetchMembers();

    socket.on('borrowUpdated', (updated) => {
      setRecords((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
      );
    });

    socket.on('borrowDeleted', ({ id }) => {
      setRecords((prev) => prev.filter((r) => r._id !== id));
    });

    socket.on('availabilityChanged', ({ bookId, availableCopies }) => {
      // Re-sync borrows to ensure accurate status
      fetchBorrows();
      setBooks((prev) => prev.map((b) => (b._id === bookId ? { ...b, availableCopies } : b)));
    });

    return () => {
      socket.off('borrowUpdated');
      socket.off('borrowDeleted');
      socket.off('availabilityChanged');
    };
  }, []);

  // Book picker for the Issue Book modal: with a catalogue in the thousands,
  // fetching every book up front (like the member list below) isn't viable -
  // instead fetch a small, search-limited page of available books, refreshed
  // whenever the modal is open and the search text changes.
  useEffect(() => {
    if (!issueModalOpen) return;
    const t = setTimeout(() => {
      fetchIssueBooks();
    }, 300);
    return () => clearTimeout(t);
  }, [issueModalOpen, bookSearch]);

  async function fetchBorrows() {
    try {
      setLoading(true);
      const res = await api.get('/borrow');
      setRecords(res.data);
      setError('');
    } catch (err) {
      setError('Could not load borrow records.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMembers() {
    try {
      const res = await api.get('/users', { params: { role: 'member' } });
      setMembers(res.data);
    } catch (err) {
      // Non-fatal - the issue modal just falls back to an empty member list
    }
  }

  async function fetchIssueBooks() {
    try {
      const res = await api.get('/books', {
        params: { limit: 20, availability: 'available', search: bookSearch || undefined },
      });
      setBooks(res.data.books);
    } catch (err) {
      // Non-fatal - the issue modal just falls back to an empty dropdown
    }
  }

  async function handleMarkReturned(recordId) {
    try {
      await api.put(`/borrow/${recordId}/return`);
      fetchBorrows();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark book as returned.');
    }
  }

  async function handleExtendLoan() {
    if (!extendRecord) return;
    try {
      await api.put(`/borrow/${extendRecord._id}/extend`, { days: extendDays });
      setExtendRecord(null);
      fetchBorrows();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to extend loan.');
    }
  }

  async function handleDeleteRecord() {
    if (!deleteRecord) return;
    try {
      await api.delete(`/borrow/${deleteRecord._id}`);
      setDeleteRecord(null);
      fetchBorrows();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete record.');
    }
  }

  async function handleWaiveFine(recordId) {
    try {
      await api.put(`/borrow/${recordId}/waive-fine`);
      fetchBorrows();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to waive fine.');
    }
  }

  function openIssueModal() {
    setIssueForm({ bookId: '', memberId: '', dueDate: defaultDueDate() });
    setBookSearch('');
    setIssueError('');
    setIssueModalOpen(true);
  }

  async function handleIssueBook(e) {
    e.preventDefault();
    setIssueError('');
    setIssueSubmitting(true);
    try {
      await api.post('/borrow/issue', issueForm);
      setIssueModalOpen(false);
      fetchBorrows();
      fetchIssueBooks();
    } catch (err) {
      setIssueError(err.response?.data?.message || 'Failed to issue book.');
    } finally {
      setIssueSubmitting(false);
    }
  }

  const filteredRecords = records.filter((r) => {
    const bookTitle = r.book?.title?.toLowerCase() || '';
    const memberName = r.member?.name?.toLowerCase() || '';
    const memberEmail = r.member?.email?.toLowerCase() || '';
    const memberId = r.member?.memberId?.toLowerCase() || '';
    const studentId = r.member?.studentId?.toLowerCase() || '';
    const query = search.toLowerCase();

    const matchesSearch =
      bookTitle.includes(query) ||
      memberName.includes(query) ||
      memberEmail.includes(query) ||
      memberId.includes(query) ||
      studentId.includes(query);

    const isReturned = !!r.returnDate;
    const isOverdue = !isReturned && new Date(r.dueDate) < new Date();
    const isActive = !isReturned && !isOverdue;

    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'overdue') return matchesSearch && isOverdue;
    if (statusFilter === 'returned') return matchesSearch && isReturned;
    return matchesSearch;
  });

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Manage Borrows & Loans
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              Track active borrowing, process returns, and grant due-date extensions.
            </p>
          </div>
          <button
            onClick={openIssueModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-sky-600 text-on-primary font-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors shadow-sm shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Issue Book
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-4 py-3 font-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface dark:bg-slate-800 p-4 rounded-xl border border-outline-variant dark:border-slate-700">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search book or member name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-surface-container-low dark:bg-slate-900 p-1 rounded-lg border border-outline-variant dark:border-slate-700 overflow-x-auto w-full sm:w-auto">
            {['all', 'active', 'overdue', 'returned'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setSearchParams({ filter: tab });
                }}
                className={`px-3 py-1.5 rounded-md font-label-md text-xs uppercase font-semibold transition-colors capitalize ${
                  statusFilter === tab
                    ? 'bg-primary dark:bg-sky-600 text-on-primary shadow-xs'
                    : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-200'
                }`}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Borrows Table */}
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant dark:text-slate-400">Loading borrow records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-12 text-center border border-outline-variant dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant dark:text-slate-400 mb-2">
              receipt_long
            </span>
            <p className="font-headline-sm text-on-surface dark:text-slate-100">No borrow records found</p>
          </div>
        ) : (
          <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-900/80 border-b border-outline-variant dark:border-slate-700 font-label-md text-xs text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Book Title</th>
                    <th className="py-3.5 px-4">Borrower</th>
                    <th className="py-3.5 px-4">Borrow Date</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Fine</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-slate-700/60 font-body-md text-sm text-on-surface dark:text-slate-100">
                  {filteredRecords.map((r) => {
                    const isReturned = !!r.returnDate;
                    const isOverdue = !isReturned && new Date(r.dueDate) < new Date();

                    return (
                      <tr key={r._id} className="hover:bg-surface-variant/30 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-label-lg font-semibold text-on-surface dark:text-slate-100">
                            {r.book?.title || 'Unknown Book'}
                          </p>
                          <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">
                            by {r.book?.author || 'N/A'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-label-md font-semibold text-on-surface dark:text-slate-100">
                            {r.member?.name || 'Unknown User'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {r.member?.memberId && (
                              <span className="font-mono text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-300">
                                {r.member.memberId}
                              </span>
                            )}
                            <span className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">
                              {r.member?.email || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-on-surface-variant dark:text-slate-400">
                          {new Date(r.borrowDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span
                            className={
                              isOverdue ? 'text-error dark:text-rose-400 font-semibold' : 'text-on-surface-variant dark:text-slate-400'
                            }
                          >
                            {new Date(r.dueDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold ${
                              isReturned
                                ? 'bg-secondary/15 dark:bg-emerald-950/60 text-secondary dark:text-emerald-300'
                                : isOverdue
                                ? 'bg-error/15 dark:bg-rose-950/60 text-error dark:text-rose-300'
                                : 'bg-tertiary/15 dark:bg-amber-950/60 text-tertiary dark:text-amber-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isReturned ? 'bg-secondary dark:bg-emerald-400' : isOverdue ? 'bg-error dark:bg-rose-400' : 'bg-tertiary dark:bg-amber-400'
                              }`}
                            />
                            {isReturned ? 'Returned' : isOverdue ? 'Overdue' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {!isReturned ? (
                            <span className="text-xs text-on-surface-variant dark:text-slate-400">—</span>
                          ) : r.fineAmount > 0 ? (
                            r.fineWaived ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold bg-secondary/15 dark:bg-emerald-950/60 text-secondary dark:text-emerald-300">
                                Waived
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-label-sm text-xs font-semibold text-error dark:text-rose-400">
                                  ${r.fineAmount.toFixed(2)}
                                </span>
                                <button
                                  onClick={() => handleWaiveFine(r._id)}
                                  className="px-2 py-0.5 rounded bg-tertiary/10 dark:bg-amber-950/60 text-tertiary dark:text-amber-300 hover:bg-tertiary/20 dark:hover:bg-amber-900/60 font-label-sm text-[11px] font-semibold transition-colors"
                                  title="Waive this fine"
                                  type="button"
                                >
                                  Waive
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-on-surface-variant dark:text-slate-400">No fine</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isReturned && (
                              <>
                                <button
                                  onClick={() => handleMarkReturned(r._id)}
                                  className="px-2.5 py-1 rounded bg-secondary/10 dark:bg-emerald-950/60 text-secondary dark:text-emerald-300 hover:bg-secondary/20 dark:hover:bg-emerald-900/60 font-label-sm text-xs font-semibold transition-colors"
                                  title="Mark book as returned"
                                  type="button"
                                >
                                  Return
                                </button>
                                <button
                                  onClick={() => setExtendRecord(r)}
                                  className="px-2.5 py-1 rounded bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-300 hover:bg-primary/20 dark:hover:bg-sky-900/60 font-label-sm text-xs font-semibold transition-colors"
                                  title="Extend loan due date"
                                  type="button"
                                >
                                  Extend
                                </button>
                              </>
                            )}
                            {isAdmin(user) && (
                              <button
                                onClick={() => setDeleteRecord(r)}
                                className="p-1 rounded text-on-surface-variant dark:text-slate-400 hover:text-error dark:hover:text-rose-400 hover:bg-error/10 dark:hover:bg-rose-950/50 transition-colors"
                                title="Delete borrow record"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Issue Book Modal */}
        {issueModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100">Issue Book to Member</h2>
                <button
                  onClick={() => setIssueModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-variant dark:hover:bg-slate-700 text-on-surface-variant dark:text-slate-400"
                  type="button"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {issueError && (
                <p className="mb-4 p-3 rounded-lg bg-error-container dark:bg-rose-950/60 text-on-error-container dark:text-rose-200 font-body-sm text-xs">
                  {issueError}
                </p>
              )}

              <form onSubmit={handleIssueBook} className="flex flex-col gap-4">
                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Member *
                  </label>
                  <select
                    required
                    value={issueForm.memberId}
                    onChange={(e) => setIssueForm({ ...issueForm, memberId: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  >
                    <option value="">Select a member</option>
                    {members.map((m) => (
                      <option key={m._id} value={m._id}>{m.name} ({m.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Book *
                  </label>
                  <input
                    type="text"
                    placeholder="Search by title, author, or ISBN..."
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    className="w-full mb-2 px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                  <select
                    required
                    value={issueForm.bookId}
                    onChange={(e) => setIssueForm({ ...issueForm, bookId: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  >
                    <option value="">Select a book</option>
                    {books.map((b) => (
                      <option key={b._id} value={b._id}>{b.title} ({b.availableCopies} available)</option>
                    ))}
                  </select>
                  {books.length === 0 && bookSearch && (
                    <p className="mt-1 font-body-sm text-xs text-on-surface-variant dark:text-slate-400">
                      No available books match &quot;{bookSearch}&quot;.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={issueForm.dueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIssueModalOpen(false)}
                    className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issueSubmitting}
                    className="px-4 py-2 bg-primary dark:bg-sky-600 text-on-primary rounded-lg font-label-md text-sm hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-50"
                  >
                    {issueSubmitting ? 'Issuing...' : 'Issue Book'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Extend Due Date Modal */}
        {extendRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-primary dark:text-sky-400 mb-2">schedule</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Extend Loan Period</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-4">
                Extend due date for <span className="font-semibold text-on-surface dark:text-slate-100">"{extendRecord.book?.title}"</span>.
              </p>

              <div className="mb-6 text-left">
                <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                  Additional Days
                </label>
                <select
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                >
                  <option value={3}>+ 3 Days</option>
                  <option value={7}>+ 7 Days (1 Week)</option>
                  <option value={14}>+ 14 Days (2 Weeks)</option>
                  <option value={30}>+ 30 Days (1 Month)</option>
                </select>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setExtendRecord(null)}
                  className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExtendLoan}
                  className="px-4 py-2 bg-primary dark:bg-sky-600 text-on-primary rounded-lg font-label-md text-sm hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Record Modal */}
        {deleteRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-error dark:text-rose-400 mb-2">delete_forever</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Delete Borrow Record?</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-6">
                Are you sure you want to delete this borrow record? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteRecord(null)}
                  className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRecord}
                  className="px-4 py-2 bg-error dark:bg-rose-600 text-on-error rounded-lg font-label-md text-sm hover:bg-error/90 dark:hover:bg-rose-500 transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
