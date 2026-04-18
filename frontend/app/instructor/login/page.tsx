'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { login } from '@/services/auth';
import { saveAuthToken } from '@/lib/auth';

function decodeJwt(token: string) {
  try {
    const payload = token.split('.')[1];
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function InstructorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login({ email, password });
      const { access_token, refresh_token } = result;
      const payload = decodeJwt(access_token);
      const incomingRole = String(payload.role ?? payload.role_name ?? '').trim().toLowerCase().replace(/\s+/g, '_');

      if (incomingRole !== 'instructor') {
        setError('Access denied. Use the instructor login only for instructor accounts.');
        setLoading(false);
        return;
      }

      saveAuthToken(access_token);
      if (refresh_token) {
        window.localStorage.setItem('refresh_token', refresh_token);
      }
      router.push('/instructor');
    } catch (err: any) {
      setError('Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-16">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-indigo-500/20 backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white">Instructor sign in</h1>
          <p className="mt-3 text-sm text-slate-300">Sign in with the credentials created by your organization administrator.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error ? (
            <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/20">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                placeholder="instructor@school.com"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                placeholder="••••••••"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center text-sm">
          <div className="text-slate-400">
            Don't have an account? <Link href="/instructor/register" className="font-semibold text-indigo-400 hover:text-indigo-300">Create instructor account</Link>
          </div>
          <div className="border-t border-white/10 pt-3 text-slate-400">
            Not an instructor? <Link href="/login" className="font-semibold text-white hover:text-slate-100">Back to regular login</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
