'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchStudentAssignments } from '@/services/assignments';
import AssignmentStatusBadge from '@/components/AssignmentStatusBadge';
import type { Assignment } from '@/types/assignment';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAssignments() {
      try {
        const data = await fetchStudentAssignments();
        setAssignments(data);
      } catch (err) {
        setError('Unable to load assignments. Please sign in and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadAssignments();
  }, []);

  return (
    <main className="w-full min-h-screen bg-slate-50 px-6 lg:px-10 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Assignments</p>
          <h1 className="mt-3 text-3xl font-semibold">Your assignments</h1>
          <p className="mt-2 text-slate-600">Review current tasks, deadlines, and submit your work directly from the LMS.</p>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading assignments…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-slate-600">No assignments are available right now.</div>
        ) : (
          <div className="grid gap-6">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold text-slate-900">{assignment.title}</h2>
                      <AssignmentStatusBadge assignment={assignment} submission={assignment.submission} />
                    </div>
                    <p className="text-slate-600 mb-2">{assignment.instructions ?? 'No additional instructions provided.'}</p>
                    <p className="text-sm text-slate-500">Course: {assignment.course_name}</p>
                  </div>
                  <div className="space-y-1 text-right text-sm text-slate-600">
                    <p>Max score: {assignment.max_score}</p>
                    {assignment.due_date ? <p>Due {new Date(assignment.due_date).toLocaleDateString()}</p> : null}
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    {assignment.submission ? 'View Submission' : 'Submit Assignment'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
