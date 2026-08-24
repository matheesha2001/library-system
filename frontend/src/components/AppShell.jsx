import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import { isAdmin, isPanelUser } from '../utils/permissions';

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, '');

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/books', label: 'Browse Books', icon: 'menu_book' },
  { to: '/my-borrows', label: 'My Borrowings', icon: 'import_contacts' },
  { to: '/profile', label: 'Profile', icon: 'account_circle' },
];

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase()).join('');
  return letters || '?';
}

export function avatarUrl(profilePicture) {
  return profilePicture ? `${API_ORIGIN}${profilePicture}` : '';
}

function NavLinks({ onNavigate }) {
  const location = useLocation();
  return (
    <ul className="flex flex-col gap-1 px-2">
      {NAV_ITEMS.map((item) => {
        const active = location.pathname === item.to;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className={`mx-2 flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                active
                  ? 'bg-secondary-container text-on-secondary-container dark:bg-slate-700 dark:text-white'
                  : 'bg-transparent text-on-surface-variant hover:bg-surface-variant/50 dark:text-slate-300 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-background text-on-background dark:bg-slate-900 dark:text-slate-100 font-body-lg antialiased transition-colors">
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 py-base bg-surface-container-low dark:bg-slate-800 border-r border-outline-variant dark:border-slate-700 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-headline-md text-headline-md text-primary dark:text-sky-400">Bindly</span>
            <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 mt-1">
              {isAdmin(user) ? 'Librarian' : isPanelUser(user) ? 'Staff' : 'Member'}
            </p>
          </div>
        </div>
        <div className="flex-grow mt-4">
          <NavLinks />
        </div>
        <div className="px-4 pb-4 flex flex-col gap-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-lg px-4 py-3 bg-transparent text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            type="button"
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="font-label-md text-label-md">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
          {isPanelUser(user) && (
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-3 rounded-lg px-4 py-3 bg-transparent text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span className="font-label-md text-label-md">{isAdmin(user) ? 'Admin Panel' : 'Staff Panel'}</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-4 py-3 bg-transparent text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-md text-label-md">Logout</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-col min-h-screen md:ml-64">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 h-16 px-margin-mobile md:px-margin-desktop bg-surface dark:bg-slate-800 border-b border-outline-variant dark:border-slate-700">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="bg-transparent text-on-surface dark:text-slate-100 p-1"
              aria-label="Toggle menu"
              type="button"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="font-headline-md text-headline-md text-primary dark:text-sky-400">Bindly</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            {avatarUrl(user?.profilePicture) ? (
              <img
                src={avatarUrl(user?.profilePicture)}
                alt=""
                className="w-9 h-9 rounded-full object-cover bg-surface-variant dark:bg-slate-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary dark:bg-sky-600 text-on-primary flex items-center justify-center font-label-md text-label-md">
                {initials(user?.name)}
              </div>
            )}
            <span className="font-label-md text-label-md text-on-surface dark:text-slate-100 hidden sm:block">
              {user?.name}
            </span>
          </div>
        </header>

        {mobileOpen && (
          <div className="md:hidden bg-surface-container-low dark:bg-slate-800 border-b border-outline-variant dark:border-slate-700 py-2">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="px-4 mt-1 flex flex-col gap-1">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 rounded-lg px-4 py-3 bg-transparent text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50"
                type="button"
              >
                <span className="material-symbols-outlined">
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
                <span className="font-label-md text-label-md">
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </button>
              {isPanelUser(user) && (
                <Link
                  to="/admin/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 bg-transparent text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50"
                >
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                  <span className="font-label-md text-label-md">{isAdmin(user) ? 'Admin Panel' : 'Staff Panel'}</span>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-lg px-4 py-3 bg-transparent text-on-surface-variant dark:text-slate-300 hover:bg-surface-variant/50 dark:hover:bg-slate-700/50"
                type="button"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-label-md text-label-md">Logout</span>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-margin-mobile md:px-margin-desktop py-8">
          <div className="max-w-container-max mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
