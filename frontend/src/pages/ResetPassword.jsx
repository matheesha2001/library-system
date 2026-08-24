import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-margin-mobile md:p-margin-desktop w-full relative min-h-screen bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 font-body-lg antialiased transition-colors">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat dark:opacity-40"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAmLRdQAXX59rW9Uo5yXy2KbTMBL9QG06n_xl8IZzVb7VtnNh9w-DSkQubC1K8kAAkxxAoPduOtNNIdGdoaI9s6ts-O2XAGULJ282mMBLRJ_ZkEdh0Jk1Q56Ctn2K3gGCwZW05t3cgV5fePZ36HLrd7t6YaKOtfKLB6gJZM0ZW1_nGP1Pwvw13LZ3QvpE_aBJVN8JaJhXvn2IvhTwo1fMSzGWLmbkCkogi4ViK03ZGRHrEModr0_SUj')" }}
      ></div>

      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest dark:bg-slate-800/95 p-8 md:p-10 rounded-2xl shadow-lg border border-outline-variant/30 dark:border-slate-700 flex flex-col gap-stack-lg backdrop-blur-xs">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-headline-lg text-headline-lg text-primary dark:text-sky-400 mb-1">Bindly</h1>
          <h2 className="font-headline-md text-title-lg text-on-surface dark:text-slate-100 mb-1 mt-stack-md">Choose a new password</h2>
          <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Make it at least 8 characters</p>
        </div>

        {error && <p className="text-center font-body-md text-body-md text-error dark:text-rose-400">{error}</p>}
        {success && (
          <p className="flex items-center justify-center gap-2 rounded-lg bg-secondary-container dark:bg-emerald-950/60 border border-secondary/30 px-3 py-2 text-center font-body-md text-body-md text-on-secondary-container dark:text-emerald-300">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Password reset! Redirecting to sign in&hellip;
          </p>
        )}

        <form className="flex flex-col gap-stack-lg" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-stack-sm">
            <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="password">New Password</label>
            <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">lock</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-stack-sm">
            <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="confirmPassword">Confirm New Password</label>
            <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">lock_reset</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="••••••••"
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            className="w-full py-3 px-4 bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex justify-center items-center gap-2 disabled:opacity-60"
            type="submit"
            disabled={loading || success}
          >
            {loading ? 'Resetting...' : success ? 'Success!' : 'Reset Password'}
            {!loading && !success && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        </form>

        <div className="text-center pt-stack-md border-t border-outline-variant/30 dark:border-slate-700">
          <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
            <Link className="font-label-md text-label-md text-primary dark:text-sky-400 hover:underline focus:outline-none focus:underline" to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
