import { useEffect, useState } from 'react';
import api from '../api/client';
import socket from '../api/socket';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import { isPanelUser } from '../utils/permissions';

const PAGE_SIZE = 24;

export default function Books() {
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');
  const [newBook, setNewBook] = useState({ title: '', author: '', isbn: '', totalCopies: 1 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { user } = useAuth();

  useEffect(() => {
    fetchBooks();

    // Listen for real-time events broadcast from the server.
    // This is the WebSocket requirement: when ANY client borrows/returns
    // a book, every connected browser sees the copy count update instantly.
    socket.on('availabilityChanged', ({ bookId, availableCopies }) => {
      setBooks((prev) =>
        prev.map((b) => (b._id === bookId ? { ...b, availableCopies } : b))
      );
    });

    // A book was added/deleted somewhere - re-fetch the current page rather
    // than patching in place, since the catalogue is now paginated and a
    // manual insert/removal would leave the page size and total out of sync.
    socket.on('bookAdded', () => fetchBooks());
    socket.on('bookDeleted', () => fetchBooks());

    return () => {
      socket.off('availabilityChanged');
      socket.off('bookAdded');
      socket.off('bookDeleted');
    };
  }, [page]);

  async function fetchBooks() {
    try {
      const res = await api.get('/books', { params: { page, limit: PAGE_SIZE } });
      setBooks(res.data.books);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      setError('Could not load books');
    }
  }

  async function handleBorrow(bookId) {
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 2 week loan period
      await api.post('/borrow', { bookId, dueDate });
      // No need to manually update state here - the socket event will do it
    } catch (err) {
      setError(err.response?.data?.message || 'Could not borrow book');
    }
  }

  async function handleAddBook(e) {
    e.preventDefault();
    try {
      await api.post('/books', newBook);
      setNewBook({ title: '', author: '', isbn: '', totalCopies: 1 });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add book');
    }
  }

  async function handleDelete(bookId) {
    try {
      await api.delete(`/books/${bookId}`);
    } catch (err) {
      setError('Could not delete book');
    }
  }

  return (
    <AppShell>
    <div className="page">
      <h1>Book Catalogue</h1>
      {error && <p className="error-text">{error}</p>}

      {isPanelUser(user) && (
        <form className="inline-form" onSubmit={handleAddBook}>
          <h2>Add a book</h2>
          <input
            placeholder="Title"
            value={newBook.title}
            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
            required
          />
          <input
            placeholder="Author"
            value={newBook.author}
            onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
            required
          />
          <input
            placeholder="ISBN"
            value={newBook.isbn}
            onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
            required
          />
          <input
            type="number"
            min="1"
            placeholder="Copies"
            value={newBook.totalCopies}
            onChange={(e) => setNewBook({ ...newBook, totalCopies: Number(e.target.value) })}
            required
          />
          <button type="submit">Add book</button>
        </form>
      )}

      <div className="book-grid">
        {books.map((book) => (
          <div className="book-card" key={book._id}>
            <h3>{book.title}</h3>
            <p>by {book.author}</p>
            <p className="isbn">ISBN: {book.isbn}</p>
            <p className={book.availableCopies > 0 ? 'available' : 'unavailable'}>
              {book.availableCopies} / {book.totalCopies} available
            </p>
            <div className="card-actions">
              <button onClick={() => handleBorrow(book._id)} disabled={book.availableCopies < 1}>
                Borrow
              </button>
              {isPanelUser(user) && (
                <button className="danger" onClick={() => handleDelete(book._id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {books.length === 0 && <p>No books in the catalogue yet.</p>}
      </div>

      {totalPages > 1 && (
        <div className="card-actions" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </button>
          <span style={{ padding: '0 0.5rem' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
    </AppShell>
  );
}
