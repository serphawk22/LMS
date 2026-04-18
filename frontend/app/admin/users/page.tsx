'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listOrganizationUsers,
  createOrganizationUser,
  updateOrganizationUser,
  deleteOrganizationUser,
} from '@/services/organizations';

interface OrganizationUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_name?: string;
  is_active?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'instructor' as 'instructor' });

  const normalizeRole = (user: OrganizationUser) => (user.role || user.role_name || '').toLowerCase();
  const instructorUsers = users.filter((user) => normalizeRole(user) === 'instructor');
  const studentUsers = users.filter((user) => normalizeRole(user) === 'student');

  const refreshUsers = async () => {
    try {
      setError('');
      const response = await listOrganizationUsers();
      setUsers(response);
    } catch (err: any) {
      setError(err?.message || 'Unable to load organization users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await createOrganizationUser({
        full_name: newUser.full_name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      });
      setSuccess('User created successfully.');
      setNewUser({ full_name: '', email: '', password: '', role: 'instructor' });
      await refreshUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to create user.');
    }
  };

  const handleToggleActive = async (user: OrganizationUser) => {
    try {
      await updateOrganizationUser(user.id, { is_active: !user.is_active });
      setSuccess('User status updated.');
      await refreshUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to update user.');
    }
  };

  const handleDelete = async (user: OrganizationUser) => {
    if (!confirm(`Remove ${user.full_name || user.email} from organization?`)) return;
    try {
      await deleteOrganizationUser(user.id);
      setSuccess('User deleted.');
      await refreshUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to delete user.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between rounded-3xl bg-white px-8 py-6 shadow-md">
          <div>
            <h1 className="text-2xl font-semibold">Organization users</h1>
            <p className="mt-1 text-sm text-slate-600">Manage registered students and create instructors for your organization.</p>
          </div>
          <Link href="/admin" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Back to admin dashboard
          </Link>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Invite new instructor</h2>
          <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              value={newUser.full_name}
              onChange={(e) => setNewUser((prev) => ({ ...prev, full_name: e.target.value }))}
              required
              placeholder="Full name"
              className="rounded-xl border border-slate-300 px-4 py-2"
            />
            <input
              value={newUser.email}
              onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
              required
              placeholder="Email"
              type="email"
              className="rounded-xl border border-slate-300 px-4 py-2"
            />
            <input
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
              required
              placeholder="Password"
              type="password"
              className="rounded-xl border border-slate-300 px-4 py-2"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as 'instructor' }))}
              className="rounded-xl border border-slate-300 px-4 py-2"
            >
              <option value="instructor">Instructor</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 sm:col-span-2"
            >
              Create user
            </button>
          </form>
          {success && <p className="mt-3 text-sm text-green-600">{success}</p>}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </section>

        <section className="rounded-3xl bg-slate-50 border border-slate-200 p-6 text-sm text-slate-600 shadow-sm">
          <p>
            Instructor accounts can sign in with credentials created here at{' '}
            <Link href="/instructor/login" className="font-semibold text-slate-900 hover:text-slate-700">
              /instructor/login
            </Link>
            .
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Registered instructors</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading instructors...</p>
          ) : error ? (
            <p className="mt-4 text-sm text-rose-600">{error}</p>
          ) : instructorUsers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No instructors have been created yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {instructorUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-2">{user.full_name || '—'}</td>
                      <td className="px-4 py-2">{user.email}</td>
                      <td className="px-4 py-2">{user.role || user.role_name || 'N/A'}</td>
                      <td className="px-4 py-2">{user.is_active ? 'Active' : 'Disabled'}</td>
                      <td className="px-4 py-2 space-x-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Registered students</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading students...</p>
          ) : error ? (
            <p className="mt-4 text-sm text-rose-600">{error}</p>
          ) : studentUsers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No students registered yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-2">{user.full_name || '—'}</td>
                      <td className="px-4 py-2">{user.email}</td>
                      <td className="px-4 py-2">{user.role || user.role_name || 'N/A'}</td>
                      <td className="px-4 py-2">{user.is_active ? 'Active' : 'Disabled'}</td>
                      <td className="px-4 py-2 space-x-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
