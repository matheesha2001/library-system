import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH = [
  { label: '', color: 'bg-outline-variant' },
  { label: 'Weak', color: 'bg-error' },
  { label: 'Fair', color: 'bg-on-tertiary-container' },
  { label: 'Good', color: 'bg-secondary' },
  { label: 'Strong', color: 'bg-primary' },
];

export default function Register() {
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [touchedTerms, setTouchedTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const passwordsMismatch = touchedConfirm && confirmPassword.length > 0 && confirmPassword !== form.password;

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setTouchedConfirm(true);
    setTouchedTerms(true);

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (confirmPassword !== form.password) {
      setError('Passwords do not match');
      return;
    }
    if (!agreed) {
      setError('You must accept the Terms & Conditions to continue');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-primary dark:bg-slate-950 font-body-lg antialiased transition-colors">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-tertiary-fixed/30 dark:bg-sky-900/30 blur-3xl"></div>
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-secondary-container/25 dark:bg-indigo-900/30 blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-on-tertiary-container/20 dark:bg-slate-800/40 blur-3xl"></div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row lg:items-stretch">
        <section className="flex flex-col justify-center px-margin-mobile py-12 text-on-primary md:px-margin-desktop lg:w-5/12 lg:py-0">
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-tertiary-fixed dark:text-sky-400">Bindly</h1>
          <h2 className="mt-stack-md font-headline-md text-headline-md text-white">
            Your library,<br />open to everyone.
          </h2>
          <p className="mt-stack-sm max-w-sm font-body-md text-body-md text-primary-fixed-dim dark:text-slate-300">
            Create your account to borrow books, track due dates, and manage your reading &mdash; all in one place.
          </p>

          <div className="mt-stack-lg hidden lg:block" aria-hidden="true">
            <svg width="220" height="160" viewBox="0 0 220 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="18" y="96" width="184" height="14" rx="4" fill="#455f88" />
              <g>
                <rect x="30" y="40" width="34" height="60" rx="3" fill="#ffdea5" />
                <rect x="30" y="40" width="34" height="10" rx="3" fill="#c0994e" />
                <rect x="70" y="24" width="34" height="76" rx="3" fill="#d1e1fa" />
                <rect x="70" y="24" width="34" height="10" rx="3" fill="#86a0cd" />
                <rect x="110" y="52" width="34" height="48" rx="3" fill="#d6e3ff" />
                <rect x="110" y="52" width="34" height="10" rx="3" fill="#adc7f7" />
              </g>
              <path d="M150 100V56c14-8 34-8 48 0v44c-14-8-34-8-48 0Z" fill="#f7fafc" stroke="#adc7f7" strokeWidth="2" />
              <path d="M174 56v44" stroke="#adc7f7" strokeWidth="2" />
            </svg>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-margin-mobile py-10 md:px-margin-desktop lg:py-16">
          <div className="w-full max-w-md rounded-2xl border border-white/15 dark:border-slate-700 bg-surface-container-lowest/90 dark:bg-slate-800/95 p-8 shadow-lg backdrop-blur-xl md:p-10">
            <div className="mb-stack-lg text-center">
              <h2 className="font-headline-md text-title-lg text-on-surface dark:text-slate-100">Create your account</h2>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Join Bindly in under a minute</p>
            </div>

            {error && (
              <p className="mb-stack-md rounded-lg bg-error-container dark:bg-rose-950/60 border border-error/30 px-3 py-2 text-center font-body-md text-body-md text-on-error-container dark:text-rose-200">
                {error}
              </p>
            )}
            {success && (
              <p className="mb-stack-md flex items-center justify-center gap-2 rounded-lg bg-secondary-container dark:bg-emerald-950/60 border border-secondary/30 px-3 py-2 text-center font-body-md text-body-md text-on-secondary-container dark:text-emerald-300">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Account created! Redirecting to sign in&hellip;
              </p>
            )}

            <form className="flex flex-col gap-stack-lg" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="name">Full Name</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">person</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                    id="name"
                    name="name"
                    placeholder="Jane Doe"
                    required
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="studentId">Student ID <span className="text-outline dark:text-slate-400">(optional)</span></label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">badge</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                    id="studentId"
                    name="studentId"
                    placeholder="S-2026-0142"
                    type="text"
                    value={form.studentId}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="email">University Email</label>
                <div className="relative flex items-center border border-outline-variant dark:border-slate-700 rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">mail</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                    id="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={form.email}
                    onChange={handleChange}
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
                    minLength={8}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button
                    className="absolute right-3 bg-transparent text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-sky-400 transition-colors focus:outline-none"
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {form.password && (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? STRENGTH[strength].color : 'bg-outline-variant dark:bg-slate-700'}`}
                        />
                      ))}
                    </div>
                    <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">{STRENGTH[strength].label}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-stack-sm">
                <label className="font-label-md text-label-md text-on-surface dark:text-slate-200" htmlFor="confirmPassword">Confirm Password</label>
                <div className={`relative flex items-center border rounded-lg bg-surface dark:bg-slate-900 halo-focus transition-colors ${passwordsMismatch ? 'border-error' : 'border-outline-variant dark:border-slate-700'}`}>
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400 ml-3 absolute pointer-events-none">lock_reset</span>
                  <input
                    className="w-full pl-10 pr-10 py-3 bg-transparent border-none rounded-lg font-body-md text-body-md text-on-surface dark:text-slate-100 placeholder:text-outline focus:ring-0 focus:outline-none"
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="••••••••"
                    required
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setTouchedConfirm(true)}
                  />
                  <button
                    className="absolute right-3 bg-transparent text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-sky-400 transition-colors focus:outline-none"
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    <span className="material-symbols-outlined">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {passwordsMismatch && (
                  <p className="font-label-md text-label-md text-error dark:text-rose-400">Passwords do not match</p>
                )}
              </div>

              {/* Public sign-up only ever creates a member ("Student") account.
                  Staff accounts are created by an admin from the admin panel
                  (Manage Users -> Create Staff Account), never self-registered. */}

              <div className="flex flex-col gap-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    className="mt-0.5 rounded border-outline-variant dark:border-slate-700 text-primary focus:ring-primary bg-surface dark:bg-slate-900 w-4 h-4 transition-colors"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setTouchedTerms(true);
                    }}
                  />
                  <span className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
                    I agree to the <a className="text-primary dark:text-sky-400 hover:underline" href="#">Terms &amp; Conditions</a> and <a className="text-primary dark:text-sky-400 hover:underline" href="#">Privacy Policy</a>
                  </span>
                </label>
                {touchedTerms && !agreed && (
                  <p className="font-label-md text-label-md text-error dark:text-rose-400">You must accept the Terms &amp; Conditions</p>
                )}
              </div>

              <button
                className="w-full py-3 px-4 bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex justify-center items-center gap-2 disabled:opacity-60"
                type="submit"
                disabled={loading || success}
              >
                {loading ? 'Creating account...' : success ? 'Success!' : 'Sign Up'}
                {!loading && !success && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            </form>

            <div className="text-center pt-stack-md mt-stack-lg border-t border-outline-variant/30 dark:border-slate-700">
              <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
                Already have an account?{' '}
                <Link className="font-label-md text-label-md text-primary dark:text-sky-400 hover:underline focus:outline-none focus:underline" to="/login">Sign in</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
