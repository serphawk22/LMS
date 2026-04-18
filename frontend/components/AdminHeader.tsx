'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { clearAuthToken } from '@/lib/auth';

const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];

const adminNav = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users', exact: false },
  { href: '/admin/students', label: 'Students', exact: false },
  { href: '/admin/payments', label: 'Payments', exact: false },
  { href: '/admin/comments', label: 'Comments', exact: false },
  { href: '/gamification/admin', label: 'Gamification', exact: false },
];

export function AdminHeader() {
  const { authenticated, role, organization } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;

  const handleLogout = () => {
    clearAuthToken();
    router.push('/admin/login');
  };

  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/register';

  /* ── minimal header for auth pages ───────────────────────── */
  if (isAuthPage) {
    return (
      <header className="admin-header border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">A</span>
            <span className="text-sm font-semibold text-white tracking-wide">LMS Admin</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/admin/login"
              className={`rounded-lg px-4 py-2 font-medium transition ${pathname === '/admin/login' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Sign in
            </Link>
            <Link
              href="/admin/register"
              className={`rounded-lg px-4 py-2 font-medium transition ${pathname === '/admin/register' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'}`}
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  /* ── full admin header ───────────────────────────────────── */
  return (
    <header className="admin-header border-b border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6">
        {/* top bar */}
        <div className="flex items-center justify-between py-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">A</span>
            <span className="text-sm font-semibold text-white tracking-wide">LMS Admin</span>
          </Link>

          <div className="flex items-center gap-4 text-sm">
            {authenticated && isAdmin ? (
              <>
                {/* Organization Info Section */}
                <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 truncate">Organization</p>
                    <p className="text-sm font-medium text-white truncate">
                      {organization?.name || 'Loading...'}
                    </p>
                  </div>
                </div>

                {/* Profile Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40"
                    aria-label="Profile menu"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </button>
                  {profileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                      <div className="border-b border-slate-700 px-4 py-3">
                        <p className="text-xs text-slate-400">Admin Account</p>
                        <p className="mt-1 text-sm font-medium text-white capitalize">{role?.replace('_', ' ')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleLogout();
                          setProfileMenuOpen(false);
                        }}
                        className="w-full rounded-b-xl px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/" className="text-slate-400 transition hover:text-white">
                  ← Back to site
                </Link>

                {authenticated ? (
                  <span className="text-xs text-amber-400/80">Not an admin account</span>
                ) : (
                  <Link
                    href="/admin/login"
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
                  >
                    Sign in
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* nav tabs */}
        {authenticated && isAdmin && (
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {adminNav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition ${
                    active
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
