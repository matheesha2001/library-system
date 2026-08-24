import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isPanelUser } from '../utils/permissions';

// Keyed by the `?error=` value a redirect can land on this page with -
// either from the Google OAuth callback (backend/routes/authRoutes.js) or
// from the API client's own 401 interceptor (api/client.js).
const LOGIN_ERROR_MESSAGES = {
  google_no_email: "Google didn't provide an email address for your account. Please sign in with email and password instead.",
  google_auth_failed: 'Google sign-in failed. Please try again, or sign in with email and password.',
  session_expired: 'Your session has expired. Please sign in again.',
};

const GOOGLE_LOGIN_URL = `${api.defaults.baseURL}/auth/google`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [role, setRole] = useState('patron');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(LOGIN_ERROR_MESSAGES[urlError] || 'Sign-in failed. Please try again.');
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.user, res.data.token);
      // The role tabs above are just a UI hint - the account's actual role
      // (returned by the server) decides where sign-in lands.
      navigate(isPanelUser(res.data.user) ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-margin-mobile md:p-margin-desktop w-full relative min-h-screen bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 font-body-lg antialiased transition-colors">
      {/* CSS-only stand-in for a library-aisle photo (amber ceiling glow,
          brown/burgundy shelves fading to a teal-gray floor) so the page
          doesn't depend on an external hotlinked image URL. */}
      <div
        className="absolute inset-0 z-0 dark:opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 140% 110% at 50% 50%, transparent 38%, rgba(8, 6, 5, 0.72) 100%),
            radial-gradient(ellipse 70% 55% at 50% 8%, rgba(255, 200, 130, 0.5), transparent 62%),
            radial-gradient(ellipse 40% 90% at 5% 50%, rgba(94, 54, 34, 0.55), transparent 65%),
            radial-gradient(ellipse 40% 90% at 95% 50%, rgba(94, 54, 34, 0.55), transparent 65%),
            linear-gradient(180deg, #2a1c14 0%, #1d140e 45%, #17120f 68%, #223330 100%)
          `,
        }}
      ></div>

      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest dark:bg-slate-800/95 p-8 md:p-10 rounded-2xl shadow-lg border border-outline-variant/30 dark:border-slate-700 flex flex-col gap-stack-lg backdrop-blur-xs">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-headline-lg text-headline-lg text-primary dark:text-sky-400 mb-1">Bindly</h1>
          <h2 className="font-headline-md text-title-lg text-on-surface dark:text-slate-100 mb-1 mt-stack-md">Sign In</h2>
          <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Access your library account</p>
        </div>

        <div className="flex bg-surface-container-low dark:bg-slate-900 p-1 rounded-lg border border-outline-variant/50 dark:border-slate-700">
          <button
            type="button"
            aria-pressed={role === 'patron'}
            onClick={() => setRole('patron')}
            className={`flex-1 py-2 px-4 rounded-md font-label-md text-label-md transition-all focus:outline-none ${
              role === 'patron'
                ? 'bg-surface dark:bg-slate-800 text-primary dark:text-sky-400 shadow-sm'
                : 'bg-transparent text-on-surface-variant dark:text-slate-400 hover:bg-surface-variant/50 dark:hover:bg-slate-800/50'
            }`}
          >
            Student 
          </button>
          <button
            type="button"
            aria-pressed={role === 'librarian'}
            onClick={() => setRole('librarian')}
            className={`flex-1 py-2 px-4 rounded-md font-label-md text-label-md transition-all focus:outline-none ${
              role === 'librarian'
                ? 'bg-surface dark:bg-slate-800 text-primary dark:text-sky-400 shadow-sm'
                : 'bg-transparent text-on-surface-variant dark:text-slate-400 hover:bg-surface-variant/50 dark:hover:bg-slate-800/50'
            }`}
          >
             Staff
          </button>
        </div>

        {error && <p className="text-center font-body-md text-body-md text-error dark:text-rose-400">{error}</p>}

        <form className="flex flex-col gap-stack-lg" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-stack-sm">
            <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="email">Email Address</label>
            <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">mail</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                id="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-stack-sm">
            <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="password">Password</label>
            <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">lock</span>
              <input
                className="w-full pl-10 pr-10 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="absolute right-3 bg-transparent text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-sky-400 transition-colors focus:outline-none"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
              >
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                className="rounded border-outline-variant dark:border-slate-700 text-primary focus:ring-primary bg-surface dark:bg-slate-900 w-4 h-4 transition-colors"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Remember me</span>
            </label>
            <Link className="font-label-md text-label-md text-primary dark:text-sky-400 hover:underline focus:outline-none focus:underline" to="/forgot-password">Forgot password?</Link>
          </div>

          <button
            className="w-full py-3 px-4 bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex justify-center items-center gap-2 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
            {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-outline-variant dark:bg-slate-700" />
          <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">or</span>
          <div className="h-px flex-1 bg-outline-variant dark:bg-slate-700" />
        </div>

        <a
          href={GOOGLE_LOGIN_URL}
          className="w-full py-3 px-4 bg-surface-container-low dark:bg-slate-900 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-100 font-label-md text-label-md rounded-lg hover:bg-surface-variant/50 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
          </svg>
          Sign in with Google
        </a>

        <div className="text-center pt-stack-md border-t border-outline-variant/30 dark:border-slate-700">
          <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link className="font-label-md text-label-md text-primary dark:text-sky-400 hover:underline focus:outline-none focus:underline" to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
