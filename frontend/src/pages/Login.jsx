import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isPanelUser } from '../utils/permissions';

const OAUTH_ERROR_MESSAGES = {
  github_no_email: "GitHub didn't provide an email address for your account. Make sure your GitHub account has a verified, public email, or sign in with email and password instead.",
  github_auth_failed: 'GitHub sign-in failed. Please try again, or sign in with email and password.',
};

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
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(OAUTH_ERROR_MESSAGES[oauthError] || 'Sign-in failed. Please try again.');
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
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat dark:opacity-40"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAmLRdQAXX59rW9Uo5yXy2KbTMBL9QG06n_xl8IZzVb7VtnNh9w-DSkQubC1K8kAAkxxAoPduOtNNIdGdoaI9s6ts-O2XAGULJ282mMBLRJ_ZkEdh0Jk1Q56Ctn2K3gGCwZW05t3cgV5fePZ36HLrd7t6YaKOtfKLB6gJZM0ZW1_nGP1Pwvw13LZ3QvpE_aBJVN8JaJhXvn2IvhTwo1fMSzGWLmbkCkogi4ViK03ZGRHrEModr0_SUj')" }}
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
            <a className="font-label-md text-label-md text-primary dark:text-sky-400 hover:underline focus:outline-none focus:underline" href="#">Forgot password?</a>
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
