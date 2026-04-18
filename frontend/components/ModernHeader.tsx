'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { ProfileDropdown } from './ProfileDropdown';

interface ModernHeaderProps {
  showNav?: boolean;
  userName?: string;
  userInitials?: string;
  userImageUrl?: string;
}

const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];
const INSTRUCTOR_ROLES = ['instructor', ...ADMIN_ROLES];

export function ModernHeader({ showNav = true, userName = 'User', userInitials = 'U', userImageUrl }: ModernHeaderProps) {
  const { authenticated, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
  const isInstructor = role ? INSTRUCTOR_ROLES.includes(role) : false;

  const navItems = [
    { href: '/courses', label: 'Courses', icon: '📚' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊', show: authenticated },
    { href: '/assignments', label: 'Assignments', icon: '✅', show: authenticated },
    { href: '/instructor', label: 'Instructor', icon: '👨‍🏫', show: isInstructor },
    { href: '/gamification', label: 'Gamification', icon: '🏆', show: authenticated },
    { href: '/admin', label: 'Admin', icon: '⚙️', show: isAdmin },
    { href: '/analytics', label: 'Analytics', icon: '📈', show: isAdmin },
    { href: '/certificates', label: 'Certificates', icon: '🎖️', show: authenticated },
  ].filter(item => item.show !== false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100/50 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg group-hover:shadow-lg transition-shadow duration-200">
              L
            </div>
            <span className="text-lg font-bold text-slate-900 hidden sm:inline group-hover:text-blue-600 transition-colors">
              LMS
            </span>
          </Link>

          {/* Desktop Navigation */}
          {showNav && authenticated && (
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
                >
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="md:hidden">{item.icon}</span>
                </Link>
              ))}
            </nav>
          )}

          {/* Right side - Profile and Mobile Menu */}
          <div className="flex items-center gap-4">
            {authenticated && <NotificationBell />}
            {authenticated && <ProfileDropdown userInitials={userInitials} userName={userName} userImageUrl={userImageUrl} />}

            {!authenticated && (
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

            {/* Mobile Menu Button */}
            {showNav && authenticated && (
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

        {/* Mobile Navigation */}
        {showNav && authenticated && mobileMenuOpen && (
          <nav className="lg:hidden border-t border-slate-100 py-3 space-y-1">
            {navItems.map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
