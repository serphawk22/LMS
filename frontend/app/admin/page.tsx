'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchAdminDashboardOverview } from '@/services/dashboard';
import type { AdminDashboardOverview } from '@/types/dashboard';

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAdminOverview() {
      try {
        const data = await fetchAdminDashboardOverview();
        setOverview(data);
      } catch (err) {
        setError('Unable to load admin data. You may not have admin access.');
      } finally {
        setLoading(false);
      }
    }

    loadAdminOverview();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-10">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold">Admin panel</h1>
          <p className="mt-2 text-slate-600">Manage your organization, review platform health, and view admin metrics.</p>
        </section>

        {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error}</div> : null}

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/admin/users" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h3 className="text-lg font-semibold">User management</h3>
            <p className="mt-2 text-sm text-slate-600">Create and manage instructors.</p>
          </Link>
          <Link href="/admin/courses" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h3 className="text-lg font-semibold">Course management</h3>
            <p className="mt-2 text-sm text-slate-600">Manage course catalogs, modules, and publishing.</p>
          </Link>
          <Link href="/admin/student-activities" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h3 className="text-lg font-semibold">Student activities</h3>
            <p className="mt-2 text-sm text-slate-600">Review learner engagement, progress, and activity logs.</p>
          </Link>
          <Link href="/admin/daily-videos" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h3 className="text-lg font-semibold">Daily learning videos</h3>
            <p className="mt-2 text-sm text-slate-600">View all student video uploads and Vimeo submissions.</p>
          </Link>
          <Link href="/admin/instructor-activities" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h3 className="text-lg font-semibold">Instructor activities</h3>
            <p className="mt-2 text-sm text-slate-600">Monitor instructor workflows, assignments, and support actions.</p>
          </Link>
          <Link href="/admin/comments" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h3 className="text-lg font-semibold">Admin comments system</h3>
            <p className="mt-2 text-sm text-slate-600">Read and respond to administrative comments from staff.</p>
          </Link>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading admin overview…</div>
        ) : overview ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Total users</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{overview.total_users}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Total courses</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{overview.total_courses}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Active users</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{overview.active_users}</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
