import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AppShell, { initials } from '../components/AppShell';
import MonthlyBorrowChart from '../components/MonthlyBorrowChart';
import { isOverdue, estimateFine } from '../utils/fines';
import { MAX_BOOKS_PER_MEMBER } from '../utils/borrowLimits';

function daysBetween(a, b) {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [meRes, borrowRes] = await Promise.all([api.get('/auth/me'), api.get('/borrow')]);
        if (cancelled) return;
        setProfile(meRes.data);
        setRecords(borrowRes.data);
      } catch (err) {
        if (!cancelled) setError('Could not load your dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const myRecords = useMemo(
    () => records.filter((r) => (r.member?._id || r.member?.id || r.member) === profile?._id),
    [records, profile]
  );

  const now = new Date();
  const current = myRecords.filter((r) => !r.returnDate);
  const history = myRecords.filter((r) => r.returnDate);
  const overdue = current
    .filter((r) => isOverdue(r))
    .map((r) => ({ ...r, daysOverdue: daysBetween(now, new Date(r.dueDate)) }));
  const dueSoon = current.filter((r) => {
    const diff = daysBetween(new Date(r.dueDate), now) * -1;
    return diff >= 0 && diff <= 3;
  });
  const pendingRenewals = current.filter((r) => r.renewalRequested);

  async function handleReturn(recordId) {
    try {
      await api.put(`/borrow/${recordId}/return`);
      const res = await api.get('/borrow');
      setRecords(res.data);
    } catch {
      setError('Could not return that book');
    }
  }

  if (loading) {
    return (
      <AppShell>
        <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Loading your dashboard&hellip;</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-stack-lg">
        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-3 py-2 font-body-md text-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {/* Profile section */}
        <div
          className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center"
        >
          <div className="w-20 h-20 rounded-full bg-primary dark:bg-sky-600 text-on-primary flex items-center justify-center font-headline-md text-headline-md flex-shrink-0">
            {initials(profile?.name)}
          </div>
          <div className="flex-1">
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">{profile?.name}</h1>
            <p className="font-label-md text-label-md text-outline dark:text-slate-400 mt-0.5">Member ID: {profile?.memberId || 'Not assigned'}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-stack-md">
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Student ID</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.studentId || '—'}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Email</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.email}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Role</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5 capitalize">{profile?.role}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Member Since</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-5 border border-outline-variant dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Currently Borrowed</span>
              <span className="material-symbols-outlined text-primary dark:text-sky-400 text-[20px]">import_contacts</span>
            </div>
            <div className="font-headline-lg text-headline-lg text-primary dark:text-sky-400">
              {current.length}
              <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">/{MAX_BOOKS_PER_MEMBER}</span>
            </div>
          </div>
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-5 border border-outline-variant dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Borrowing History</span>
              <span className="material-symbols-outlined text-secondary dark:text-purple-400 text-[20px]">history</span>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface dark:text-slate-100">{history.length}</div>
          </div>
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-5 border border-outline-variant dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Pending Requests</span>
              <span className="material-symbols-outlined text-on-tertiary-container dark:text-amber-400 text-[20px]">pending_actions</span>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface dark:text-slate-100">{pendingRenewals.length}</div>
          </div>
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-5 border border-error/30 dark:border-rose-900 bg-error-container/10 dark:bg-rose-950/20 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="font-label-md text-label-md text-error dark:text-rose-400 uppercase tracking-wider">Overdue</span>
              <span className="material-symbols-outlined text-error dark:text-rose-400 text-[20px]">warning</span>
            </div>
            <div className="font-headline-lg text-headline-lg text-error dark:text-rose-400">{overdue.length}</div>
          </div>
        </div>

        <MonthlyBorrowChart endpoint="/reports/monthly-borrows/me" title="Your Monthly Borrowing Activity" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg">
          {/* Currently borrowed + history */}
          <div className="lg:col-span-2 flex flex-col gap-stack-lg">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-outline-variant dark:border-slate-700">
                <h3 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100">Currently Borrowed</h3>
              </div>
              <div className="divide-y divide-outline-variant/50 dark:divide-slate-700/50">
                {current.length === 0 && (
                  <p className="p-4 font-body-md text-body-md text-on-surface-variant dark:text-slate-400">You don&apos;t have any books checked out right now.</p>
                )}
                {current.map((r) => {
                  const late = isOverdue(r);
                  const fine = estimateFine(r);
                  return (
                    <div key={r._id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 font-semibold">{r.book?.title}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 mt-0.5">
                          by {r.book?.author} &middot; Due {new Date(r.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {late && (
                          <span className="font-label-md text-label-md text-error dark:text-rose-400">
                            Overdue{fine > 0 ? ` · $${fine.toFixed(2)} fine` : ''}
                          </span>
                        )}
                        <button
                          onClick={() => handleReturn(r._id)}
                          className="bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md px-3 py-1.5 rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors"
                          type="button"
                        >
                          Return
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-outline-variant dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100">Borrowing History</h3>
                <Link to="/my-borrows" className="font-label-md text-label-md text-primary dark:text-sky-400 hover:underline">View All</Link>
              </div>
              <div className="divide-y divide-outline-variant/50 dark:divide-slate-700/50">
                {history.length === 0 && (
                  <p className="p-4 font-body-md text-body-md text-on-surface-variant dark:text-slate-400">No returned books yet.</p>
                )}
                {history.slice(0, 5).map((r) => (
                  <div key={r._id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-body-md text-body-md text-on-surface dark:text-slate-100">{r.book?.title}</p>
                      <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 mt-0.5">
                        Returned {new Date(r.returnDate).toLocaleDateString()}
                      </p>
                    </div>
                    {r.fineAmount > 0 ? (
                      <span
                        className={`font-label-md text-label-md flex-shrink-0 ${
                          r.fineWaived ? 'text-secondary dark:text-emerald-400' : 'text-error dark:text-rose-400'
                        }`}
                      >
                        {r.fineWaived ? 'Fine waived' : `$${r.fineAmount.toFixed(2)} fine`}
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-secondary dark:text-emerald-400 text-[20px]">task_alt</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-outline-variant dark:border-slate-700">
                <h3 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100">Pending Renewal Requests</h3>
              </div>
              {pendingRenewals.length === 0 ? (
                <p className="p-4 font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
                  Borrows and returns are instant, so the only thing that ever waits here is a renewal request - nothing pending right now.
                </p>
              ) : (
                <div className="divide-y divide-outline-variant/50 dark:divide-slate-700/50">
                  {pendingRenewals.map((r) => (
                    <div key={r._id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 font-semibold">{r.book?.title}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 mt-0.5">
                          Requested {new Date(r.renewalRequestedAt).toLocaleDateString()} &middot; awaiting staff review
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-tertiary dark:text-amber-400 text-[20px]">hourglass_top</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overdue + notifications + quick actions */}
          <div className="flex flex-col gap-stack-lg">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-error/30 dark:border-rose-900/50 shadow-sm p-5">
              <h3 className="font-title-lg text-title-lg text-error dark:text-rose-400 mb-stack-sm">Overdue Books</h3>
              {overdue.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Nothing overdue &mdash; you&apos;re all caught up.</p>
              ) : (
                <ul className="flex flex-col gap-stack-sm">
                  {overdue.map((r) => (
                    <li key={r._id} className="flex items-center justify-between gap-2">
                      <span className="font-body-md text-body-md text-on-surface dark:text-slate-100">{r.book?.title}</span>
                      <span className="font-label-md text-label-md text-error dark:text-rose-400 flex-shrink-0">
                        {r.daysOverdue}d late{estimateFine(r) > 0 ? ` · $${estimateFine(r).toFixed(2)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm p-5">
              <h3 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100 mb-stack-sm">Notifications</h3>
              <ul className="flex flex-col gap-stack-md">
                {overdue.map((r) => (
                  <li key={`ov-${r._id}`} className="flex gap-3">
                    <span className="material-symbols-outlined text-error dark:text-rose-400 text-[20px]">warning</span>
                    <p className="font-body-md text-body-md text-on-surface dark:text-slate-100">
                      <span className="font-semibold">{r.book?.title}</span> is {r.daysOverdue} day{r.daysOverdue === 1 ? '' : 's'} overdue.
                    </p>
                  </li>
                ))}
                {dueSoon.map((r) => (
                  <li key={`ds-${r._id}`} className="flex gap-3">
                    <span className="material-symbols-outlined text-on-tertiary-container dark:text-amber-400 text-[20px]">schedule</span>
                    <p className="font-body-md text-body-md text-on-surface dark:text-slate-100">
                      <span className="font-semibold">{r.book?.title}</span> is due {new Date(r.dueDate).toLocaleDateString()}.
                    </p>
                  </li>
                ))}
                {overdue.length === 0 && dueSoon.length === 0 && (
                  <li className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">You&apos;re all caught up &mdash; no alerts right now.</li>
                )}
              </ul>
            </div>

            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm p-5">
              <h3 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100 mb-stack-md">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <Link
                  to="/books"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 bg-surface-container-low dark:bg-slate-900 text-on-surface dark:text-slate-100 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary dark:text-sky-400">menu_book</span>
                  <span className="font-label-md text-label-md">Browse Books</span>
                </Link>
                <Link
                  to="/my-borrows"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 bg-surface-container-low dark:bg-slate-900 text-on-surface dark:text-slate-100 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary dark:text-sky-400">import_contacts</span>
                  <span className="font-label-md text-label-md">My Borrowings</span>
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 bg-surface-container-low dark:bg-slate-900 text-on-surface dark:text-slate-100 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary dark:text-sky-400">settings</span>
                  <span className="font-label-md text-label-md">Profile Settings</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
