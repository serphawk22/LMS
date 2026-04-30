'use client';


import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { clearAuthToken } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import InstructorProfilePanel from '@/components/InstructorProfilePanel';
import { fetchCurrentUser, uploadAvatar } from '@/services/auth';
import ThemeToggle from '@/components/ThemeToggle';

const instructorNav = [
  { href: '/dashboard/instructor/my-courses', label: 'My Courses' },
  { href: '/dashboard/instructor/create-course', label: 'Create Course' },
  { href: '/dashboard/instructor/live-classes', label: 'Live Classes' },
  { href: '/dashboard/instructor/students', label: 'Students' },
  { href: '/dashboard/instructor/analytics', label: 'Analytics' },
  { href: '/dashboard/instructor/quizzes', label: 'Quizzes' },
  { href: '/dashboard/instructor/assignments', label: 'Assignments' },
  { href: '/dashboard/instructor/reviews', label: 'Reviews' },
  { href: '/dashboard/instructor/discussions', label: 'Discussions' },
];

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, initialized, role, userId } = useAuth();
  const [profile, setProfile] = useState<{ name: string; email: string; avatarUrl: string | null }>({ name: '', email: '', avatarUrl: null });
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      setProfile({
        name: user.full_name || 'Instructor',
        email: user.email || '',
        avatarUrl: user.avatar_url || null,
      });
    });
  }, []);

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const { url } = await uploadAvatar(file);
      setProfile((prev) => ({ ...prev, avatarUrl: url }));
    } finally {
      setAvatarUploading(false);
    }
  };
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  const { theme } = useTheme();

  if (!initialized) {
    return null;
  }

  if (!authenticated) {
    router.push('/login');
    return null;
  }

  // Hide sidebar, profile panel, and dashboard header for live class creation page
  const isLiveClassCreate = pathname === '/dashboard/instructor/live-classes/create';
  // Hide profile panel for discussions page
  const isDiscussionsPage = pathname === '/dashboard/instructor/discussions';

  if (isLiveClassCreate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-strong)]">
        <main className="w-full max-w-3xl mx-auto p-6">
          {children}
        </main>
      </div>
    );
  }

  // ...existing code...
  return (
    <div className="flex h-screen bg-[var(--surface-strong)]">
      {/* Profile Panel (Desktop) - Hidden for discussions page */}
      <div className="hidden lg:block" style={{ display: isDiscussionsPage ? 'none' : 'block' }}>
        <InstructorProfilePanel
          name={profile.name}
          email={profile.email}
          avatarUrl={profile.avatarUrl}
          onAvatarUpload={handleAvatarUpload}
        />
      </div>
      {/* Mobile Header with Profile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[var(--card-color)] border-b border-[var(--border-color)] shadow-sm">
        {/* ...existing code... */}
      </div>
      {/* Sidebar Navigation (Desktop) */}
      <div className="hidden lg:flex flex-col w-64 min-h-screen pt-60 pl-2 bg-transparent z-20">
        {/* ...existing code... */}
      </div>
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden ml-0 lg:ml-[18rem)] pt-14 lg:pt-0">
        {/* Desktop Header */}
        {/* ...existing code... */}
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-color)]">
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