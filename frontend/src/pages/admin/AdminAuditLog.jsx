import { useEffect, useState } from 'react';
import api from '../../api/client';
import AdminLayout from './AdminLayout';

const ACTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'user.block', label: 'User Blocked' },
  { value: 'user.unblock', label: 'User Unblocked' },
  { value: 'user.roleChange', label: 'Role Changed' },
  { value: 'user.delete', label: 'User Deleted' },
  { value: 'borrow.delete', label: 'Borrow Record Deleted' },
  { value: 'book.delete', label: 'Book Deleted' },
];

const ACTION_LABELS = Object.fromEntries(ACTIONS.map((a) => [a.value, a.label]));

function targetSummary(entry) {
  const d = entry.details || {};
  if (entry.action === 'user.roleChange') return `${d.from} → ${d.to}`;
  if (d.targetName || d.targetEmail) return d.targetName || d.targetEmail;
  if (d.title) return `${d.title}${d.isbn ? ` (${d.isbn})` : ''}`;
  return entry.targetId;
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  async function fetchLogs() {
    try {
      setLoading(true);
      const res = await api.get('/audit-log', {
        params: actionFilter !== 'all' ? { action: actionFilter } : undefined,
      });
      setLogs(res.data);
      setError('');
    } catch (err) {
      setError('Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Audit Log
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              A record of sensitive staff/admin actions - blocks, unblocks, role changes, and deletions - most recent first.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-4 py-3 font-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-2 bg-surface dark:bg-slate-800 p-4 rounded-xl border border-outline-variant dark:border-slate-700">
          <label className="font-label-sm text-xs text-on-surface-variant dark:text-slate-400 uppercase tracking-wider shrink-0">
            Action:
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Log Table */}
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant dark:text-slate-400">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-12 text-center border border-outline-variant dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant dark:text-slate-400 mb-2">
              history_toggle_off
            </span>
            <p className="font-headline-sm text-on-surface dark:text-slate-100">No log entries found</p>
          </div>
        ) : (
          <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-900/80 border-b border-outline-variant dark:border-slate-700 font-label-md text-xs text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3.5 px-4">When</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-slate-700/60 font-body-md text-sm text-on-surface dark:text-slate-100">
                  {logs.map((entry) => (
                    <tr key={entry._id} className="hover:bg-surface-variant/30 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-on-surface-variant dark:text-slate-400 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-label-md font-semibold text-on-surface dark:text-slate-100">
                          {entry.actor?.name || 'Unknown'}
                        </p>
                        <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">
                          {entry.actor?.email}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-300">
                          {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-on-surface-variant dark:text-slate-400">
                        {targetSummary(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
