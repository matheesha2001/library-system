import { useEffect, useState } from 'react';
import api from '../../api/client';
import socket from '../../api/socket';
import AdminLayout from './AdminLayout';
import { initials } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, isStaff } from '../../utils/permissions';

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Selected User Detail Drawer State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Role Modal
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [newRole, setNewRole] = useState('member');

  // Delete Modal
  const [deleteUserModal, setDeleteUserModal] = useState(null);

  // Block Modal
  const [blockUserModal, setBlockUserModal] = useState(null);

  // Create Staff Account Modal
  const [createStaffModalOpen, setCreateStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', staffId: '', department: '' });
  const [staffFormError, setStaffFormError] = useState('');
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();

    socket.on('userUpdated', (payload) => {
      setUsers((prev) =>
        prev.map((u) => (u._id === payload.id ? { ...u, ...payload } : u))
      );
    });

    socket.on('userDeleted', ({ id }) => {
      setUsers((prev) => prev.filter((u) => u._id !== id));
    });

    return () => {
      socket.off('userUpdated');
      socket.off('userDeleted');
    };
  }, []);

  // Staff may only block/unblock member accounts, and nobody can act on
  // their own account - matches the restrictions in userRoutes.js.
  function canToggleBlock(target) {
    if (!user || target._id === user.id) return false;
    if (isAdmin(user)) return true;
    if (isStaff(user)) return target.role === 'member';
    return false;
  }

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
      setError('');
    } catch (err) {
      setError('Could not load users list.');
    } finally {
      setLoading(false);
    }
  }

  async function viewUserHistory(target) {
    setSelectedUser(target);
    setDetailLoading(true);
    try {
      const res = await api.get(`/users/${target._id}`);
      setUserDetail(res.data);
    } catch (err) {
      setError('Could not load user borrow history.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRoleUpdate() {
    if (!roleModalUser) return;
    try {
      await api.put(`/users/${roleModalUser._id}/role`, { role: newRole });
      setRoleModalUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update user role.');
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserModal) return;
    try {
      await api.delete(`/users/${deleteUserModal._id}`);
      setDeleteUserModal(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete user.');
    }
  }

  async function handleBlockUser() {
    if (!blockUserModal) return;
    try {
      await api.put(`/users/${blockUserModal._id}/block`);
      setBlockUserModal(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not block user.');
    }
  }

  async function handleUnblockUser(target) {
    try {
      await api.put(`/users/${target._id}/unblock`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not unblock user.');
    }
  }

  function openCreateStaffModal() {
    setStaffForm({ name: '', email: '', password: '', staffId: '', department: '' });
    setStaffFormError('');
    setCreateStaffModalOpen(true);
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    setStaffFormError('');
    setStaffSubmitting(true);
    try {
      await api.post('/staff/register', staffForm);
      setCreateStaffModalOpen(false);
      fetchUsers();
    } catch (err) {
      setStaffFormError(err.response?.data?.message || 'Could not create staff account.');
    } finally {
      setStaffSubmitting(false);
    }
  }

  const filteredUsers = users.filter((target) => {
    const matchesSearch =
      target.name.toLowerCase().includes(search.toLowerCase()) ||
      target.email.toLowerCase().includes(search.toLowerCase()) ||
      (target.memberId && target.memberId.toLowerCase().includes(search.toLowerCase())) ||
      (target.studentId && target.studentId.toLowerCase().includes(search.toLowerCase()));

    if (roleFilter !== 'all') {
      return matchesSearch && target.role === roleFilter;
    }
    return matchesSearch;
  });

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Manage Users
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              View registered library members, assign admin privileges, and inspect loan activity.
            </p>
          </div>
          {isAdmin(user) && (
            <button
              onClick={openCreateStaffModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-sky-600 text-on-primary font-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors shadow-sm shrink-0"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Create Staff Account
            </button>
          )}
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
              placeholder="Search name, email, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-label-sm text-xs text-on-surface-variant dark:text-slate-400 uppercase tracking-wider shrink-0">
              Role:
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
            >
              <option value="all">All Roles ({users.length})</option>
              <option value="member">Members</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant dark:text-slate-400">Loading user directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-12 text-center border border-outline-variant dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant dark:text-slate-400 mb-2">
              group_off
            </span>
            <p className="font-headline-sm text-on-surface dark:text-slate-100">No users found</p>
          </div>
        ) : (
          <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-900/80 border-b border-outline-variant dark:border-slate-700 font-label-md text-xs text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Member ID</th>
                    <th className="py-3.5 px-4">Student ID</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Active Loans</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-slate-700/60 font-body-md text-sm text-on-surface dark:text-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-surface-variant/30 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-400 font-semibold flex items-center justify-center font-label-sm text-xs shrink-0">
                            {initials(u.name)}
                          </div>
                          <div>
                            <p className="font-label-lg font-semibold text-on-surface dark:text-slate-100">{u.name}</p>
                            <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-on-surface-variant dark:text-slate-400">
                        {u.memberId || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-on-surface-variant dark:text-slate-400">
                        {u.studentId || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold ${
                            u.role === 'admin'
                              ? 'bg-primary/15 dark:bg-sky-950/60 text-primary dark:text-sky-300'
                              : u.role === 'staff'
                              ? 'bg-secondary/15 dark:bg-purple-950/60 text-secondary dark:text-purple-300'
                              : 'bg-surface-variant dark:bg-slate-700 text-on-surface-variant dark:text-slate-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.role === 'admin'
                                ? 'bg-primary dark:bg-sky-400'
                                : u.role === 'staff'
                                ? 'bg-secondary dark:bg-purple-400'
                                : 'bg-on-surface-variant dark:bg-slate-400'
                            }`}
                          />
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold ${
                            u.isBlocked
                              ? 'bg-error/15 dark:bg-rose-950/60 text-error dark:text-rose-300'
                              : 'bg-secondary/15 dark:bg-emerald-950/60 text-secondary dark:text-emerald-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isBlocked ? 'bg-error dark:bg-rose-400' : 'bg-secondary dark:bg-emerald-400'
                            }`}
                          />
                          {u.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-label-md text-xs font-semibold px-2 py-0.5 rounded bg-tertiary/10 dark:bg-amber-950/60 text-tertiary dark:text-amber-300">
                          {u.activeBorrowsCount ?? 0} active
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewUserHistory(u)}
                            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-sky-400 hover:bg-primary/10 dark:hover:bg-sky-950/50 transition-colors"
                            title="View user details and history"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          {canToggleBlock(u) && (
                            <button
                              onClick={() => (u.isBlocked ? handleUnblockUser(u) : setBlockUserModal(u))}
                              className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-tertiary dark:hover:text-amber-400 hover:bg-tertiary/10 dark:hover:bg-amber-950/50 transition-colors"
                              title={u.isBlocked ? 'Unblock user' : 'Block user'}
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">{u.isBlocked ? 'lock_open' : 'lock'}</span>
                            </button>
                          )}
                          {isAdmin(user) && (
                            <button
                              onClick={() => {
                                setRoleModalUser(u);
                                setNewRole(u.role);
                              }}
                              className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-secondary dark:hover:text-purple-400 hover:bg-secondary/10 dark:hover:bg-purple-950/50 transition-colors"
                              title="Change user role"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                            </button>
                          )}
                          {isAdmin(user) && (
                            <button
                              onClick={() => setDeleteUserModal(u)}
                              className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-error dark:hover:text-rose-400 hover:bg-error/10 dark:hover:bg-rose-950/50 transition-colors"
                              title="Delete user"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Change Role Modal */}
        {roleModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-primary dark:text-sky-400 mb-2">admin_panel_settings</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Change User Role</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-4">
                Update account privileges for <span className="font-semibold text-on-surface dark:text-slate-100">{roleModalUser.name}</span>.
              </p>

              <div className="flex justify-center gap-4 mb-6">
                <label className="flex items-center gap-2 cursor-pointer font-label-md text-sm text-on-surface dark:text-slate-200">
                  <input
                    type="radio"
                    name="role"
                    value="member"
                    checked={newRole === 'member'}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="accent-primary"
                  />
                  Member
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-label-md text-sm text-on-surface dark:text-slate-200">
                  <input
                    type="radio"
                    name="role"
                    value="staff"
                    checked={newRole === 'staff'}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="accent-primary"
                  />
                  Staff
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-label-md text-sm text-on-surface dark:text-slate-200">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={newRole === 'admin'}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="accent-primary"
                  />
                  Admin
                </label>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRoleUpdate}
                  className="px-4 py-2 bg-primary dark:bg-sky-600 text-on-primary rounded-lg font-label-md text-sm hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors"
                >
                  Save Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {deleteUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-error dark:text-rose-400 mb-2">person_remove</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Delete User Account?</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-4">
                Are you sure you want to permanently delete user <span className="font-semibold text-on-surface dark:text-slate-100">{deleteUserModal.name}</span>?
              </p>
              {deleteUserModal.activeBorrowsCount > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-error-container dark:bg-rose-950/60 text-on-error-container dark:text-rose-200 font-body-sm text-xs text-left border border-error/30">
                  ⚠️ Note: User currently has {deleteUserModal.activeBorrowsCount} active unreturned book(s). You must process returns first.
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteUserModal(null)}
                  className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={deleteUserModal.activeBorrowsCount > 0}
                  className="px-4 py-2 bg-error dark:bg-rose-600 text-on-error rounded-lg font-label-md text-sm hover:bg-error/90 dark:hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Block User Modal */}
        {blockUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-tertiary dark:text-amber-400 mb-2">lock</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Block User Account?</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-4">
                <span className="font-semibold text-on-surface dark:text-slate-100">{blockUserModal.name}</span> will not be able to sign in until unblocked.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setBlockUserModal(null)}
                  className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBlockUser}
                  className="px-4 py-2 bg-tertiary dark:bg-amber-600 text-on-tertiary rounded-lg font-label-md text-sm hover:bg-tertiary/90 dark:hover:bg-amber-500 transition-colors"
                >
                  Confirm Block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Staff Account Modal */}
        {createStaffModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100">Create Staff Account</h2>
                <button
                  onClick={() => setCreateStaffModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-variant dark:hover:bg-slate-700 text-on-surface-variant dark:text-slate-400"
                  type="button"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {staffFormError && (
                <p className="mb-4 p-3 rounded-lg bg-error-container dark:bg-rose-950/60 text-on-error-container dark:text-rose-200 font-body-sm text-xs">
                  {staffFormError}
                </p>
              )}

              <form onSubmit={handleCreateStaff} className="flex flex-col gap-4">
                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="jane.doe@library.lk"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Staff ID <span className="text-outline dark:text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S-2026-014"
                    value={staffForm.staffId}
                    onChange={(e) => setStaffForm({ ...staffForm, staffId: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Department <span className="text-outline dark:text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Circulation"
                    value={staffForm.department}
                    onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setCreateStaffModalOpen(false)}
                    className="px-4 py-2 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 rounded-lg font-label-md text-sm hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={staffSubmitting}
                    className="px-4 py-2 bg-primary dark:bg-sky-600 text-on-primary rounded-lg font-label-md text-sm hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-50"
                  >
                    {staffSubmitting ? 'Creating...' : 'Create Staff Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Detail & Borrow History Drawer / Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 h-full w-full max-w-lg p-6 shadow-2xl overflow-y-auto border-l border-outline-variant dark:border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100">User Profile & Activity</h2>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 rounded-lg hover:bg-surface-variant dark:hover:bg-slate-700 text-on-surface-variant dark:text-slate-400"
                    type="button"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary dark:bg-sky-600 text-on-primary font-bold flex items-center justify-center text-lg">
                    {initials(selectedUser.name)}
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold">{selectedUser.name}</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">{selectedUser.email}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-variant dark:bg-slate-700 text-on-surface-variant dark:text-slate-300">
                        ID: {selectedUser.memberId || 'N/A'}
                      </span>
                      <span className="font-label-sm text-xs px-2 py-0.5 rounded bg-primary/10 dark:bg-sky-950/60 text-primary dark:text-sky-300 uppercase font-semibold">
                        {selectedUser.role}
                      </span>
                    </div>
                  </div>
                </div>

                <h4 className="font-label-lg text-on-surface dark:text-slate-100 font-semibold mb-3">Borrow History</h4>

                {detailLoading ? (
                  <p className="text-center py-6 text-on-surface-variant dark:text-slate-400 text-sm">Loading activity...</p>
                ) : userDetail?.borrowHistory?.length === 0 ? (
                  <p className="text-center py-6 text-on-surface-variant dark:text-slate-400 text-sm">No borrow history recorded for this user.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {userDetail?.borrowHistory?.map((record) => (
                      <div
                        key={record._id}
                        className="p-3 rounded-lg border border-outline-variant dark:border-slate-700 bg-surface-container-low dark:bg-slate-900 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-label-md text-on-surface dark:text-slate-100 font-semibold text-sm">
                            {record.book?.title || 'Unknown Title'}
                          </p>
                          <p className="font-body-sm text-xs text-on-surface-variant dark:text-slate-400">
                            Borrowed: {new Date(record.borrowDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`font-label-sm text-xs px-2.5 py-1 rounded-full font-semibold ${
                            record.returnDate
                              ? 'bg-secondary/15 dark:bg-emerald-950/60 text-secondary dark:text-emerald-300'
                              : new Date(record.dueDate) < new Date()
                              ? 'bg-error/15 dark:bg-rose-950/60 text-error dark:text-rose-300'
                              : 'bg-tertiary/15 dark:bg-amber-950/60 text-tertiary dark:text-amber-300'
                          }`}
                        >
                          {record.returnDate
                            ? 'Returned'
                            : new Date(record.dueDate) < new Date()
                            ? 'Overdue'
                            : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-outline-variant dark:border-slate-700 mt-6">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-2.5 bg-surface-variant dark:bg-slate-700 text-on-surface-variant dark:text-slate-200 font-label-md rounded-lg hover:bg-surface-variant/80 dark:hover:bg-slate-600 transition-colors"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
