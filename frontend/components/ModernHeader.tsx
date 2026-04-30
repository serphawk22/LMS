'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { ProfileDropdown } from './ProfileDropdown';
import ThemeToggle from './ThemeToggle';

interface ModernHeaderProps {
  showNav?: boolean;
  userName?: string;
  userInitials?: string;
  userImageUrl?: string;
}

const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];
const INSTRUCTOR_ROLES = ['instructor', ...ADMIN_ROLES];

export function ModernHeader({ showNav = true, userName = 'User', userInitials = 'U', userImageUrl }: ModernHeaderProps) {
  const { authenticated, initialized, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
  const isInstructor = role ? INSTRUCTOR_ROLES.includes(role) : false;

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: 'Home' },
    { href: '/courses', label: 'Learn', icon: 'Learn' },
    { href: '/support', label: 'Support', icon: 'Support' },
    { href: '/discussions', label: 'Discussions', icon: 'Discuss' },
  ].map((item) => ({
    ...item,
    active: pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(`${item.href}/`)),
  }));

  const handleCalendarClick = () => {
    router.push('/calendar');
  };

  // Wait for auth to be initialized before rendering authenticated state
  const showAuthenticatedContent = initialized && authenticated;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100/50 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="w-full px-6 lg:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg group-hover:shadow-lg transition-shadow duration-200">
              L
            </div>
            <span className="text-lg font-bold text-slate-900 hidden sm:inline group-hover:text-blue-600 transition-colors">
              LMS
            </span>
          </Link>

          {showNav && authenticated && (
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    item.active
                      ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="md:hidden">{item.icon}</span>
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3">
            {showAuthenticatedContent && (
              <>
                <button
                  onClick={handleCalendarClick}
                  className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 cursor-pointer"
                  title="Calendar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                <NotificationBell />
                <ProfileDropdown userInitials={userInitials} userName={userName} userImageUrl={userImageUrl} />
                <ThemeToggle />
              </>
            )}

            {!showAuthenticatedContent && (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {showNav && showAuthenticatedContent && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {showNav && showAuthenticatedContent && mobileMenuOpen && (
          <nav className="lg:hidden border-t border-slate-100 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  item.active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        )}
    </header>
  );
}
