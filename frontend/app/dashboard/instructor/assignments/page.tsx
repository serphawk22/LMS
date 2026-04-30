'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchInstructorAssignments } from '@/services/assignments';
import type { Assignment } from '@/types/assignment';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAssignments() {
      setLoading(true);
      setError('');
      try {
        setAssignments(await fetchInstructorAssignments());
      } catch {
        setError('Unable to load assignments.');
      } finally {
        setLoading(false);
      }
    }

    loadAssignments();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-[var(--card-color)] p-10 shadow-sm border border-[var(--border-color)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--primary-color)]">Instructor assignments</p>
              <h1 className="text-3xl font-semibold">Assignments</h1>
            </div>
            <div className="text-sm text-[var(--muted-color)]">Manage your course assignments and review student submissions.</div>
          </div>

          {error ? <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div> : null}
        </section>

        <section className="rounded-3xl bg-[var(--card-color)] p-8 shadow-sm border border-[var(--border-color)]">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-color)]">Your assignments</h2>
              <p className="text-sm text-[var(--muted-color)]">Create and manage assignments for your courses.</p>
            </div>
            <Link href="/dashboard/instructor/create-assignment" className="inline-flex items-center rounded-full bg-[var(--primary-color)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
              Create new assignment
            </Link>
          </div>
          <div className="mt-2 text-sm text-[var(--muted-color)]">{assignments.length} total</div>

          {loading ? (
            <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--surface-strong)] p-10 text-[var(--muted-color)]">Loading assignments…</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--card-color)] p-10 text-center text-[var(--muted-color)]">No assignments available.</div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-3xl border border-[var(--border-color)] bg-[var(--surface-strong)] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-color)]">{assignment.title}</h3>
                      <p className="mt-1 text-sm text-[var(--muted-color)]">
                        Course: {assignment.course_name} • Max score: {assignment.max_score} • Submissions: {assignment.submissions_count}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted-color)]">
                        {assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString()}` : 'No due date'} • {assignment.published ? 'Published' : 'Draft'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/instructor/assignments/review?assignmentId=${assignment.id}`}
                        className="rounded-full bg-[var(--primary-color)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        View submissions
                      </Link>
                      <Link
                        href={`/dashboard/instructor/create-assignment?edit=${assignment.id}`}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
