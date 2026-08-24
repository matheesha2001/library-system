import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { isOverdue, estimateFine } from '../utils/fines';

export default function MyBorrows() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    try {
      const res = await api.get('/borrow');
      setRecords(res.data);
    } catch (err) {
      setError('Could not load your borrow records');
    }
  }

  // GET /borrow intentionally returns every user's records for staff/admin
  // (that's what the admin panel's Manage Borrows page needs) - this page is
  // the member-facing "my own loans" view for every role, so it must filter
  // down to the current user regardless of who's logged in.
  const myRecords = useMemo(
    () => records.filter((r) => (r.member?._id || r.member?.id || r.member) === user?.id),
    [records, user]
  );

  async function handleReturn(recordId) {
    try {
      await api.put(`/borrow/${recordId}/return`);
      fetchRecords(); // refresh the list to show updated status
    } catch (err) {
      setError('Could not return book');
    }
  }

  async function handleRequestRenewal(recordId) {
    try {
      await api.put(`/borrow/${recordId}/request-renewal`);
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request a renewal');
    }
  }

  return (
    <AppShell>
    <div className="page">
      <h1>My Borrowed Books</h1>
      {error && <p className="error-text">{error}</p>}

      <table className="records-table">
        <thead>
          <tr>
            <th>Book</th>
            <th>Borrowed</th>
            <th>Due</th>
            <th>Status</th>
            <th>Fine</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {myRecords.map((r) => {
            // r.status is never actually set to 'overdue' by the backend
            // (it only ever writes 'borrowed' or 'returned') - compute the
            // displayed status here instead of trusting the stored field.
            const displayStatus = r.returnDate ? 'returned' : isOverdue(r) ? 'overdue' : 'borrowed';
            const fine = estimateFine(r);
            return (
              <tr key={r._id}>
                <td>{r.book?.title}</td>
                <td>{new Date(r.borrowDate).toLocaleDateString()}</td>
                <td>{new Date(r.dueDate).toLocaleDateString()}</td>
                <td className={displayStatus}>{displayStatus}</td>
                <td className={r.fineWaived ? 'returned' : fine > 0 ? 'overdue' : undefined}>
                  {fine > 0 ? (r.fineWaived ? 'Waived' : `$${fine.toFixed(2)}`) : '—'}
                </td>
                <td>
                  {!r.returnDate && (
                    <>
                      <button onClick={() => handleReturn(r._id)}>Return</button>{' '}
                      {r.renewalRequested ? (
                        <span className="overdue">Renewal requested</span>
                      ) : (
                        <button onClick={() => handleRequestRenewal(r._id)}>Request Renewal</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {myRecords.length === 0 && (
            <tr>
              <td colSpan="6">No borrow records yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </AppShell>
  );
}
