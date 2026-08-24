import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppShell, { initials } from '../components/AppShell';

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, '');

// Sri Lankan NIC: old format is 9 digits + V/X, new format is 12 digits
const NIC_PATTERN = /^(\d{9}[vVxX]|\d{12})$/;

export default function Profile() {
  const { login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    address: '',
    gender: '',
    nicNumber: '',
  });
  const [saving, setSaving] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/profile');
      setProfile(res.data);
    } catch (err) {
      setError('Could not load your profile');
    } finally {
      setLoading(false);
    }
  }

  function syncAuthContext(updated) {
    const token = localStorage.getItem('token');
    login(
      {
        id: updated._id,
        name: updated.name,
        memberId: updated.memberId,
        studentId: updated.studentId,
        email: updated.email,
        role: updated.role,
        profilePicture: updated.profilePicture,
      },
      token
    );
  }

  function startEditing() {
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
      address: profile.address || '',
      gender: profile.gender || '',
      nicNumber: profile.nicNumber || '',
    });
    setSuccess('');
    setError('');
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    if (form.nicNumber && !NIC_PATTERN.test(form.nicNumber.trim())) {
      setError('Enter a valid NIC number (9 digits + V/X, or 12 digits)');
      return;
    }

    setSaving(true);
    setSuccess('');
    try {
      const res = await api.put('/profile', form);
      setProfile(res.data);
      syncAuthContext(res.data);
      setEditing(false);
      setSuccess('Profile updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setSuccess('');
    setError('');
  }

  function cancelPictureChange() {
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUploadPicture() {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('profilePicture', selectedFile);
      const res = await api.post('/profile/picture', formData);
      setProfile(res.data);
      syncAuthContext(res.data);
      cancelPictureChange();
      setSuccess('Profile picture updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload profile picture');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Loading your profile&hellip;</p>
      </AppShell>
    );
  }

  const avatarSrc = previewUrl || (profile?.profilePicture ? `${API_ORIGIN}${profile.profilePicture}` : '');

  return (
    <AppShell>
      <div className="flex flex-col gap-stack-lg max-w-2xl">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface dark:text-slate-100">Profile Settings</h1>

        {error && (
          <p className="rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-3 py-2 font-body-md text-body-md text-on-error-container dark:text-rose-200">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg bg-secondary-container dark:bg-emerald-950/60 border border-secondary/30 px-3 py-2 font-body-md text-body-md text-on-secondary-container dark:text-emerald-300">
            {success}
          </p>
        )}

        {/* Profile picture */}
        <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover flex-shrink-0 bg-surface-variant dark:bg-slate-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary dark:bg-sky-600 text-on-primary flex items-center justify-center font-headline-md text-headline-md flex-shrink-0">
              {initials(profile?.name)}
            </div>
          )}

          <div className="flex-1">
            <p className="font-title-lg text-title-lg text-on-surface dark:text-slate-100">Profile picture</p>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-0.5">JPG or PNG, up to 5MB.</p>

            <div className="flex flex-wrap items-center gap-2 mt-stack-sm">
              <label className="bg-surface-container-low dark:bg-slate-900 text-on-surface dark:text-slate-200 font-label-md text-label-md px-4 py-2 rounded-lg cursor-pointer hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors border border-outline-variant dark:border-slate-700">
                Choose Image
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {selectedFile && (
                <>
                  <button
                    type="button"
                    onClick={handleUploadPicture}
                    disabled={uploading}
                    className="bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-60"
                  >
                    {uploading ? 'Uploading...' : 'Save Picture'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelPictureChange}
                    disabled={uploading}
                    className="bg-transparent text-on-surface-variant dark:text-slate-400 font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Account details */}
        <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-between mb-stack-md">
            <h2 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100">Account Information</h2>
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="flex items-center gap-2 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-200 font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <form className="flex flex-col gap-stack-lg" onSubmit={handleSave}>
              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="name">Full Name</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">person</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 focus:ring-0 focus:outline-none"
                    id="name"
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="email">Email</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">mail</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 focus:ring-0 focus:outline-none"
                    id="email"
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="phoneNumber">Phone Number</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">call</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 focus:ring-0 focus:outline-none"
                    id="phoneNumber"
                    type="tel"
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="address">Address</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">home</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 focus:ring-0 focus:outline-none"
                    id="address"
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="gender">Gender</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">wc</span>
                  <select
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 focus:ring-0 focus:outline-none appearance-none"
                    id="gender"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="" className="dark:bg-slate-900">Prefer not to say</option>
                    <option value="Male" className="dark:bg-slate-900">Male</option>
                    <option value="Female" className="dark:bg-slate-900">Female</option>
                    <option value="Other" className="dark:bg-slate-900">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="nicNumber">NIC Number</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">fingerprint</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 focus:ring-0 focus:outline-none"
                    id="nicNumber"
                    type="text"
                    placeholder="e.g. 991234567V or 199912345678"
                    value={form.nicNumber}
                    onChange={(e) => setForm({ ...form, nicNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="bg-transparent text-on-surface-variant dark:text-slate-400 font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Member ID</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.memberId || 'Not assigned'}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Full Name</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.name}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Email</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.email}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Student ID</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.studentId || '—'}</p>
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
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Phone Number</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.phoneNumber || '—'}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Address</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.address || '—'}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">Gender</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.gender || '—'}</p>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 uppercase tracking-wider">NIC Number</p>
                <p className="font-body-md text-body-md text-on-surface dark:text-slate-100 mt-0.5">{profile?.nicNumber || '—'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
