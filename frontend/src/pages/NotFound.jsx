import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-stack-md bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 font-body-lg antialiased transition-colors px-margin-mobile text-center">
      <span className="material-symbols-outlined text-6xl text-on-surface-variant dark:text-slate-500">search_off</span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface dark:text-slate-100">Page not found</h1>
      <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        to={user ? '/dashboard' : '/login'}
        className="mt-stack-sm inline-flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-sky-600 text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 dark:hover:bg-sky-500 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        {user ? 'Back to Dashboard' : 'Back to Sign In'}
      </Link>
    </main>
  );
}
