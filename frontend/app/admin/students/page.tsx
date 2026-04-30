'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listOrganizationUsers } from '@/services/organizations';

interface Student {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_name?: string;
  is_active?: boolean;
}

function getStudentRole(student: Student) {
  return student.role || student.role_name || '';
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setError('');
        const response = await listOrganizationUsers();
        const filteredStudents = response.filter((user) => (user.role || user.role_name || '').toLowerCase() === 'student');
        setStudents(filteredStudents);
      } catch (err: any) {
        setError(err?.message || 'Unable to load students.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <header className="flex items-center justify-between rounded-3xl bg-white px-8 py-6 shadow-md">
          <div>
            <h1 className="text-2xl font-semibold">Organization students</h1>
            <p className="mt-1 text-sm text-slate-600">View and manage students enrolled in your organization.</p>
          </div>
          <Link href="/admin" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Back to admin dashboard
          </Link>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Students</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading students...</p>
          ) : error ? (
            <p className="mt-4 text-sm text-rose-600">{error}</p>
          ) : students.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No students enrolled yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-2">{student.full_name || '—'}</td>
                      <td className="px-4 py-2">{student.email}</td>
                      <td className="px-4 py-2">{getStudentRole(student)}</td>
                      <td className="px-4 py-2">{student.is_active ? 'Active' : 'Disabled'}</td>
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
