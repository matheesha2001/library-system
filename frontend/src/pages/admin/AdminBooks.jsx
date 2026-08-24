import { useEffect, useState } from 'react';
import api from '../../api/client';
import socket from '../../api/socket';
import AdminLayout from './AdminLayout';

const PAGE_SIZE = 20;

export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(''); // raw input, debounced into `search` below
  const [search, setSearch] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null); // null = add, object = edit
  const [formData, setFormData] = useState({ title: '', author: '', isbn: '', category: '', totalCopies: 1 });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteBook, setDeleteBook] = useState(null);

  // Debounce the search box so every keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Jump back to page 1 whenever the search or filter changes, so we're
  // never stuck on a page number that no longer exists for the new query.
  useEffect(() => {
    setPage(1);
  }, [search, filterAvailability]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchBooks();

    socket.on('availabilityChanged', ({ bookId, availableCopies }) => {
      setBooks((prev) =>
        prev.map((b) => (b._id === bookId ? { ...b, availableCopies } : b))
      );
    });

    // Book list changed elsewhere - re-fetch the current page/search/filter
    // rather than patching in place, since results are now paginated and a
    // manual insert/removal would desync the page size and total count.
    socket.on('bookAdded', () => fetchBooks());
    socket.on('bookDeleted', () => fetchBooks());

    socket.on('bookUpdated', (updated) => {
      setBooks((prev) =>
        prev.map((b) => (b._id === updated._id ? { ...b, ...updated } : b))
      );
    });

    return () => {
      socket.off('availabilityChanged');
      socket.off('bookAdded');
      socket.off('bookUpdated');
      socket.off('bookDeleted');
    };
  }, [page, search, filterAvailability]);

  async function fetchBooks() {
    try {
      setLoading(true);
      const res = await api.get('/books', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          availability: filterAvailability !== 'all' ? filterAvailability : undefined,
        },
      });
      setBooks(res.data.books);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setError('');
    } catch (err) {
      setError('Failed to load books catalogue.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      // Non-fatal - the category dropdown just falls back to "No category"
    }
  }

  function openAddModal() {
    setEditingBook(null);
    setFormData({ title: '', author: '', isbn: '', category: '', totalCopies: 1 });
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(book) {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category?._id || '',
      totalCopies: book.totalCopies,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingBook) {
        // Calculate new available copies based on total copy difference
        const copyDiff = formData.totalCopies - editingBook.totalCopies;
        const newAvailable = Math.max(0, editingBook.availableCopies + copyDiff);

        await api.put(`/books/${editingBook._id}`, {
          ...formData,
          availableCopies: newAvailable,
        });
      } else {
        await api.post('/books', formData);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save book.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjustStock(book, delta) {
    const newTotal = book.totalCopies + delta;
    if (newTotal < 1) return;
    const newAvailable = book.availableCopies + delta;
    if (newAvailable < 0) return;

    try {
      await api.put(`/books/${book._id}`, {
        totalCopies: newTotal,
        availableCopies: newAvailable,
      });
    } catch (err) {
      setError('Could not update copy count.');
    }
  }

  async function confirmDelete() {
    if (!deleteBook) return;
    try {
      await api.delete(`/books/${deleteBook._id}`);
      setDeleteBook(null);
    } catch (err) {
      setError('Could not delete book record.');
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Manage Books
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              Add, update, or adjust total library book copies in real-time.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-sky-600 text-on-primary font-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors shadow-sm shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add New Book
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-4 py-3 font-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface dark:bg-slate-800 p-4 rounded-xl border border-outline-variant dark:border-slate-700">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search title, author, or ISBN..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-label-sm text-xs text-on-surface-variant dark:text-slate-400 uppercase tracking-wider shrink-0">
              Filter:
            </label>
            <select
              value={filterAvailability}
              onChange={(e) => setFilterAvailability(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
            >
              <option value="all">All Books ({total})</option>
              <option value="available">Available Only</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Book Table */}
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant dark:text-slate-400">Loading catalogue...</div>
        ) : books.length === 0 ? (
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-12 text-center border border-outline-variant dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant dark:text-slate-400 mb-2">
              search_off
            </span>
            <p className="font-headline-sm text-on-surface dark:text-slate-100">No books found</p>
            <p className="font-body-sm text-on-surface-variant dark:text-slate-400 mt-1 text-xs">
              {search ? 'Try adjusting your search criteria.' : 'Click "Add New Book" to populate the catalogue.'}
            </p>
          </div>
        ) : (
          <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-900/80 border-b border-outline-variant dark:border-slate-700 font-label-md text-xs text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Title & Author</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">ISBN</th>
                    <th className="py-3.5 px-4">Copies Status</th>
                    <th className="py-3.5 px-4">Quick Adjust</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-slate-700/60 font-body-md text-sm text-on-surface dark:text-slate-100">
                  {books.map((book) => (
                    <tr key={book._id} className="hover:bg-surface-variant/30 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-label-lg font-semibold text-on-surface dark:text-slate-100">{book.title}</p>
                        <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">by {book.author}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {book.category?.name ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-300">
                            {book.category.name}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant dark:text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-on-surface-variant dark:text-slate-400">
                        {book.isbn}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold ${
                            book.availableCopies > 0
                              ? 'bg-secondary/15 dark:bg-emerald-950/60 text-secondary dark:text-emerald-300'
                              : 'bg-error/15 dark:bg-rose-950/60 text-error dark:text-rose-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              book.availableCopies > 0 ? 'bg-secondary dark:bg-emerald-400' : 'bg-error dark:bg-rose-400'
                            }`}
                          />
                          {book.availableCopies} / {book.totalCopies} available
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center rounded-lg border border-outline-variant dark:border-slate-700 overflow-hidden bg-surface-container-low dark:bg-slate-900">
                          <button
                            onClick={() => handleAdjustStock(book, -1)}
                            disabled={book.totalCopies <= 1}
                            className="px-2 py-1 hover:bg-surface-variant dark:hover:bg-slate-800 text-on-surface dark:text-slate-100 disabled:opacity-40 transition-colors"
                            title="Decrease total copies"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-xs">remove</span>
                          </button>
                          <span className="px-3 py-1 font-label-md text-xs font-semibold">
                            {book.totalCopies}
                          </span>
                          <button
                            onClick={() => handleAdjustStock(book, 1)}
                            className="px-2 py-1 hover:bg-surface-variant dark:hover:bg-slate-800 text-on-surface dark:text-slate-100 transition-colors"
                            title="Increase total copies"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-xs">add</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(book)}
                            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-sky-400 hover:bg-primary/10 dark:hover:bg-sky-950/50 transition-colors"
                            title="Edit details"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteBook(book)}
                            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-error dark:hover:text-rose-400 hover:bg-error/10 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete book"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant dark:border-slate-700">
                <span className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">
                  Page {page} of {totalPages} &middot; {total} book{total === 1 ? '' : 's'} total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 font-label-md text-xs hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 font-label-md text-xs hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100">
                  {editingBook ? 'Edit Book' : 'Add New Book'}
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-variant dark:hover:bg-slate-700 text-on-surface-variant dark:text-slate-400"
                  type="button"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {formError && (
                <p className="mb-4 p-3 rounded-lg bg-error-container dark:bg-rose-950/60 text-on-error-container dark:text-rose-200 font-body-sm text-xs">
                  {formError}
                </p>
              )}

              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Book Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Clean Code"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Author *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Robert C. Martin"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  >
                    <option value="">No category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    ISBN *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 978-0132350884"
                    value={formData.isbn}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Total Copies *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.totalCopies}
                    onChange={(e) =>
                      setFormData({ ...formData, totalCopies: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-primary dark:bg-sky-600 text-on-primary rounded-lg font-label-md text-sm hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingBook ? 'Update Book' : 'Add Book'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-error dark:text-rose-400 mb-2">delete_forever</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Delete Book?</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-6">
                Are you sure you want to remove <span className="font-semibold text-on-surface dark:text-slate-100">"{deleteBook.title}"</span> from the library catalogue?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteBook(null)}
                  className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
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
