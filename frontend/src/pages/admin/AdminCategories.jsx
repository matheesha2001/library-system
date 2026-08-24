import { useEffect, useState } from 'react';
import api from '../../api/client';
import AdminLayout from './AdminLayout';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // null = add, object = edit
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteCategory, setDeleteCategory] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      setCategories(res.data);
      setError('');
    } catch (err) {
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(category) {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingCategory) {
        const res = await api.put(`/categories/${editingCategory._id}`, formData);
        setCategories((prev) => prev.map((c) => (c._id === res.data._id ? res.data : c)));
      } else {
        const res = await api.post('/categories', formData);
        setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCategory) return;
    setDeleteError('');
    try {
      await api.delete(`/categories/${deleteCategory._id}`);
      setCategories((prev) => prev.filter((c) => c._id !== deleteCategory._id));
      setDeleteCategory(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete category.');
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">
              Manage Categories
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
              Add, rename, or remove the book categories used across the catalogue.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-sky-600 text-on-primary font-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors shadow-sm shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Category
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-4 py-3 font-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}

        {/* Category Table */}
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant dark:text-slate-400">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="bg-surface dark:bg-slate-800 rounded-xl p-12 text-center border border-outline-variant dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant dark:text-slate-400 mb-2">
              category
            </span>
            <p className="font-headline-sm text-on-surface dark:text-slate-100">No categories yet</p>
            <p className="font-body-sm text-on-surface-variant dark:text-slate-400 mt-1 text-xs">
              Click "Add Category" to create your first one.
            </p>
          </div>
        ) : (
          <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low dark:bg-slate-900/80 border-b border-outline-variant dark:border-slate-700 font-label-md text-xs text-on-surface-variant dark:text-slate-300 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-slate-700/60 font-body-md text-sm text-on-surface dark:text-slate-100">
                  {categories.map((category) => (
                    <tr key={category._id} className="hover:bg-surface-variant/30 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-label-lg font-semibold text-on-surface dark:text-slate-100">{category.name}</p>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant dark:text-slate-400">
                        {category.description || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(category)}
                            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-sky-400 hover:bg-primary/10 dark:hover:bg-sky-950/50 transition-colors"
                            title="Edit category"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setDeleteCategory(category);
                            }}
                            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-400 hover:text-error dark:hover:text-rose-400 hover:bg-error/10 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete category"
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
          </div>
        )}

        {/* Add/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-slate-100">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
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
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Fiction"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface-variant dark:text-slate-400 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Optional short description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-lg font-body-md text-on-surface dark:text-slate-100 text-sm focus:outline-none focus:border-primary dark:focus:border-sky-500 resize-none"
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
                    {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Add Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs">
            <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 max-w-sm w-full p-6 shadow-xl text-center">
              <span className="material-symbols-outlined text-4xl text-error dark:text-rose-400 mb-2">delete_forever</span>
              <h3 className="font-headline-sm text-on-surface dark:text-slate-100 font-semibold mb-1">Delete Category?</h3>
              <p className="font-body-sm text-on-surface-variant dark:text-slate-400 text-xs mb-4">
                Are you sure you want to remove <span className="font-semibold text-on-surface dark:text-slate-100">"{deleteCategory.name}"</span>?
              </p>
              {deleteError && (
                <p className="mb-4 p-3 rounded-lg bg-error-container dark:bg-rose-950/60 text-on-error-container dark:text-rose-200 font-body-sm text-xs text-left">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteCategory(null)}
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
