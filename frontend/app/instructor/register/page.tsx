'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/services/auth';

export default function InstructorRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatErrorMessage = (errorResponse: unknown) => {
    if (typeof errorResponse === 'string') {
      return errorResponse;
    }
    if (Array.isArray(errorResponse)) {
      return errorResponse
        .map((errorItem) => {
          if (typeof errorItem === 'string') {
            return errorItem;
          }
          if (typeof errorItem === 'object' && errorItem !== null) {
            return 'message' in errorItem ? (errorItem as any).message : JSON.stringify(errorItem);
          }
          return String(errorItem);
        })
        .join(' ');
    }
    if (typeof errorResponse === 'object' && errorResponse !== null) {
      if ('message' in errorResponse) {
        return (errorResponse as any).message;
      }
      if ('detail' in errorResponse) {
        return formatErrorMessage((errorResponse as any).detail);
      }
      return JSON.stringify(errorResponse);
    }
    return 'Registration failed. Please check your details and try again.';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (!organizationName.trim()) {
      setError('Please enter an organization name (e.g. "My School") to identify your organization.');
      setLoading(false);
      return;
    }

    const generatedTenantId = organizationName.trim().toLowerCase().replace(/\s+/g, '-');
    localStorage.setItem('tenant_id', generatedTenantId);

    try {
      await register(
        { full_name: fullName, email, password, role: 'instructor' },
        generatedTenantId,
      );
      router.push('/instructor/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = formatErrorMessage(detail ?? err?.message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </div>

      <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center gap-3 group">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:shadow-lg transition-all duration-300 transform group-hover:scale-105">
                L
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                LMS
              </span>
            </Link>
          </div>

          <div className="modern-card p-8 sm:p-10 shadow-xl">
            <div className="space-y-2 mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Create instructor account</h1>
              <p className="text-slate-600">Register as an instructor to start teaching</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="fullname" className="block text-sm font-semibold text-slate-700">
                  Full name
                </label>
                <input
                  id="fullname"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  className="input-modern"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="input-modern"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="input-modern"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="org-name" className="block text-sm font-semibold text-slate-700">
                  Organization name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                  className="input-modern"
                  placeholder="e.g., My School"
                />
                <p className="text-xs text-slate-500">The name of the organization you'll be teaching with</p>
              </div>

              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                    </svg>
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

              <div className="text-center text-sm">
                <span className="text-slate-600">Already have an account? </span>
                <Link href="/instructor/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Sign in here
                </Link>
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            <Link href="/" className="text-blue-600 hover:text-blue-700">← Back to home</Link>
          </p>
        </div>
      </main>
    </>
  );
}
