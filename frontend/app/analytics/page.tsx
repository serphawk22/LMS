'use client';

import { useEffect, useState } from 'react';
import { fetchAdminDashboardOverview } from '@/services/dashboard';
import type { AdminDashboardOverview } from '@/types/dashboard';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadOverview() {
      try {
        const data = await fetchAdminDashboardOverview();
        setOverview(data);
      } catch (err) {
        setError('Unable to load analytics. Admin access is required.');
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  return (
    <main className="w-full min-h-screen bg-slate-50 px-6 lg:px-10 py-16 text-slate-900">
      <div className="w-full space-y-10">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Analytics</p>
          <h1 className="mt-3 text-3xl font-semibold">Organization performance</h1>
          <p className="mt-2 text-slate-600">View platform insights, user growth, and revenue trends for your tenant.</p>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading analytics…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error}</div>
        ) : overview ? (
          <div className="grid gap-6 lg:grid-cols-3">
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
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Organizations</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{overview.total_organizations}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">${overview.revenue.toFixed(2)}</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
