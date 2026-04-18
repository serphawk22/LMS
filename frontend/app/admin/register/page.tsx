'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';

export default function AdminRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const role = 'organization_admin';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleOrganizationNameChange = (name: string) => {
    setOrganizationName(name);
    // Auto-generate tenant ID from organization name if user hasn't manually set it
    if (!tenantId || tenantId === organizationName.toLowerCase().replace(/\s+/g, '-')) {
      setTenantId(name.toLowerCase().replace(/\s+/g, '-'));
    }
  };

  const formatError = (detail: unknown): string => {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? (d as any).msg : String(d))).join('. ');
    if (typeof detail === 'object' && detail !== null) {
      if ('message' in detail) return (detail as any).message;
      if ('detail' in detail) return formatError((detail as any).detail);
      return JSON.stringify(detail);
    }
    return 'Registration failed. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!organizationName.trim()) {
      setError('Please enter an organization name.');
      return;
    }
    if (!tenantId.trim()) {
      setError('Please enter a tenant ID.');
      return;
    }

    localStorage.setItem('tenant_id', tenantId.trim());

    setLoading(true);
    try {
      /* register with admin role via the admin endpoint (allows unrestricted role) */
      await api.post('/admin/register', {
        full_name: fullName,
        email,
        password,
        role,
      }, {
        headers: { 'x-tenant-id': tenantId.trim() },
      });

      // show success modal and then redirect to admin login
      setShowSuccessModal(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(formatError(detail ?? err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-16">
      <div className="w-full max-w-md space-y-8">

        {/* branding */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">Create admin account</h1>
          <p className="mt-2 text-sm text-slate-400">Set up a new administrator account for the LMS platform</p>
        </div>

        {/* form card */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Organization Name */}
            <div>
              <label htmlFor="admin-org-name" className="mb-2 block text-sm font-medium text-slate-300">Organization Name</label>
              <input
                id="admin-org-name" type="text" required autoFocus
                value={organizationName} onChange={(e) => handleOrganizationNameChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:bg-white/[0.08] focus:ring-2 focus:ring-indigo-500/30"
                // placeholder="e.g. My School or Rachana Corp"
              />
              <p className="mt-1.5 text-xs text-slate-500">A human-readable name for your organization.</p>
            </div>

            {/* Tenant ID */}
            <div>
              <label htmlFor="admin-tenant-id" className="mb-2 block text-sm font-medium text-slate-300">Tenant ID</label>
              <input
                id="admin-tenant-id" type="text" required
                value={tenantId} onChange={(e) => setTenantId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:bg-white/[0.08] focus:ring-2 focus:ring-indigo-500/30"
                placeholder="e.g. my-school"
              />
              <p className="mt-1.5 text-xs text-slate-500">Unique identifier for your organization (auto-generated from organization name, can be customized).</p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
              <input
                id="admin-email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:bg-white/[0.08] focus:ring-2 focus:ring-indigo-500/30"
                placeholder="admin@organization.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="admin-pass" className="mb-2 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <input
                  id="admin-pass" type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:bg-white/[0.08] focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" tabIndex={-1}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="admin-confirm" className="mb-2 block text-sm font-medium text-slate-300">Confirm password</label>
              <input
                id="admin-confirm" type="password" required autoComplete="new-password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:bg-white/[0.08] focus:ring-2 focus:ring-indigo-500/30"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
                Creating account…
              </span>
            ) : 'Create admin account'}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/admin/login" className="font-semibold text-indigo-400 transition hover:text-indigo-300">Sign in</Link>
          </p>

          <div className="mt-6 border-t border-white/[0.06] pt-5 text-center">
            <Link href="/register" className="text-xs text-slate-500 transition hover:text-slate-300">
              ← Back to student/instructor registration
            </Link>
          </div>
        </form>
      </div>
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">Account successfully created</h2>
            <p className="mt-3 text-sm text-slate-600">Your admin account has been created.</p>
            <p className="mt-2 text-sm text-slate-600">Click OK to go to admin login.</p>
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push('/admin/login');
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}    </main>
  );
}
