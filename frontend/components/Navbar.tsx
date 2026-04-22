'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { clearAuthToken } from '@/lib/auth';

const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];
const INSTRUCTOR_ROLES = ['instructor', ...ADMIN_ROLES];

export function Navbar() {
  const { authenticated, role } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
  const isInstructor = role ? INSTRUCTOR_ROLES.includes(role) : false;

  const navItems = [
    { href: '/courses', label: 'Courses', show: true },
    { href: '/dashboard', label: 'Dashboard', show: authenticated },
    { href: '/assignments', label: 'Assignments', show: authenticated },
    { href: '/instructor', label: 'Instructor', show: isInstructor },
    { href: '/gamification', label: 'Gamification', show: authenticated },
    { href: '/admin', label: 'Admin', show: isAdmin },
    { href: '/analytics', label: 'Analytics', show: isAdmin },
    { href: '/certificates', label: 'Certificates', show: authenticated },
    { href: '/account', label: 'Account', show: authenticated },
  ].filter((item) => item.show);

  return (
    <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="w-full flex items-center justify-between gap-4 px-6 lg:px-10 py-4">
        <Link href="/" className="font-semibold text-slate-900">
          LMS Platform
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 md:hidden"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">Toggle navigation</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <nav className="hidden items-center gap-4 text-sm text-slate-700 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}

            {authenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
              >
                Logout
              </button>
            ) : (
              <>
                <Link href="/login" className="rounded-full bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700">
                  Login
                </Link>
                <Link href="/register" className="rounded-full border border-slate-200 px-4 py-2 text-slate-900 transition hover:bg-slate-100">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="space-y-2 text-sm text-slate-700">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl px-4 py-3 transition hover:bg-slate-100"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {authenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Logout
              </button>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="block rounded-2xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-700"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
