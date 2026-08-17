import { useEffect, useState } from 'react';
import api from '../api/client';

export default function MyBorrows() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');

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

  async function handleReturn(recordId) {
    try {
      await api.put(`/borrow/${recordId}/return`);
      fetchRecords(); // refresh the list to show updated status
    } catch (err) {
      setError('Could not return book');
    }
  }

  return (
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r._id}>
              <td>{r.book?.title}</td>
              <td>{new Date(r.borrowDate).toLocaleDateString()}</td>
              <td>{new Date(r.dueDate).toLocaleDateString()}</td>
              <td className={r.status}>{r.status}</td>
              <td>
                {r.status === 'borrowed' && (
                  <button onClick={() => handleReturn(r._id)}>Return</button>
                )}
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan="5">No borrow records yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
