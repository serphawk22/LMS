'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const overviewCards = [
  { title: 'Total Courses', value: 12, icon: '📘', color: 'from-sky-500 to-indigo-500' },
  { title: 'Total Students', value: 342, icon: '👩‍🎓', color: 'from-emerald-500 to-teal-500' },
  { title: 'Total Revenue', value: '$18,560', icon: '💰', color: 'from-amber-500 to-orange-500' },
  { title: 'Average Rating', value: '4.8 ★', icon: '⭐', color: 'from-fuchsia-500 to-pink-500' },
];

const activityEvents = [
  { time: 'Just now', text: 'Published the new course "Advanced TypeScript".' },
  { time: '1 hour ago', text: 'Reviewed 12 student assignment submissions.' },
  { time: '3 hours ago', text: 'Created quiz "Module 3: API Integration".' },
  { time: 'Yesterday', text: 'Student "Nora" completed Course "React Mastery".' },
  { time: '2 days ago', text: 'Added new lesson "State Management with Redux".' },
];

const navLinks = [
  { href: '/dashboard/instructor/my-courses', label: 'My Courses' },
  { href: '/dashboard/instructor/create-course', label: 'New Course' },
  { href: '/dashboard/instructor/quizzes', label: 'Quizzes' },
  { href: '/dashboard/instructor/assignments', label: 'Assignments' },
  { href: '/dashboard/instructor/analytics', label: 'Results' },
];

export default function InstructorDashboardPage() {
  const { authenticated, initialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (initialized && !authenticated) {
      router.push('/login');
    }
  }, [authenticated, initialized, router]);

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="lg:flex">
        <aside className="w-full lg:w-64 border-r border-slate-200 bg-white px-4 py-6">
          <div className="mb-8">
            <h2 className="text-lg font-semibold tracking-wide text-slate-700">Instructor Menu</h2>
          </div>
          <nav className="space-y-2">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Instructor Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500">Monitor your course performance and student progress.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm border border-slate-200">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-600 to-indigo-500 flex items-center justify-center text-sm font-bold text-white">I</div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Instructor Name</p>
                <p className="text-xs text-slate-500">Online</p>
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xl">{card.icon}</span>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold text-white bg-gradient-to-r ${card.color}`}>
                    {card.title}
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
              </div>
            ))}
          </section>

          <section className="mt-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Assignments workflow</h2>
                  <p className="mt-1 text-sm text-slate-500">Quick access to assignment creation and review.</p>
                </div>
                <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">New</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/dashboard/instructor/assignments"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-white"
                >
                  Review assignments
                </Link>
                <Link
                  href="/dashboard/instructor/create-assignment"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-white"
                >
                  Create assignment
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Live</span>
              </div>
              <ul className="space-y-3">
                {activityEvents.map((event) => (
                  <li key={`${event.time}-${event.text}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">{event.text}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.time}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Quick Insights</h2>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Summary</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">Most enrolled course</p>
                  <p className="text-base font-semibold text-slate-900">React Mastery</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">Active students this week</p>
                  <p className="text-base font-semibold text-slate-900">79</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">New signups</p>
                  <p className="text-base font-semibold text-slate-900">23</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
