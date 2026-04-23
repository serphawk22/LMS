'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { clearAuthToken } from '@/lib/auth';

const instructorNav = [
  { href: '/dashboard/instructor/my-courses', label: 'My Courses' },
  { href: '/dashboard/instructor/create-course', label: 'Create Course' },
  { href: '/dashboard/instructor/live-classes', label: 'Live Classes' },
  { href: '/dashboard/instructor/students', label: 'Students' },
  { href: '/dashboard/instructor/analytics', label: 'Analytics' },
  { href: '/dashboard/instructor/quizzes', label: 'Quizzes' },
  { href: '/dashboard/instructor/assignments', label: 'Assignments' },
  { href: '/dashboard/instructor/reviews', label: 'Reviews' },
  { href: '/discussions', label: 'Discussions' },
];

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, initialized, role, userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  if (!initialized) {
    return null;
  }

  if (!authenticated) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-center h-16 px-4 bg-slate-900">
          <h1 className="text-xl font-bold text-white">Instructor Dashboard</h1>
        </div>
        <nav className="mt-8">
          <ul className="space-y-2 px-4">
            {instructorNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-slate-700">
                Welcome, Instructor
              </span>
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-full bg-slate-100 hover:bg-slate-200"
                >
                  <div className="w-8 h-8 bg-slate-400 rounded-full flex items-center justify-center text-white font-medium">
                    I
                  </div>
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}