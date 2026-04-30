'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchInstructorQuizResults } from '@/services/quiz';
import type { QuizAttemptRead } from '@/types/quiz';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail || error.response?.data?.message;
    return typeof detail === 'string' && detail ? detail : fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export default function QuizzesPage() {
  const [quizResults, setQuizResults] = useState<QuizAttemptRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuizResults() {
      try {
        const results = await fetchInstructorQuizResults(10, 0);
        setQuizResults(results);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load quiz results.'));
      } finally {
        setLoading(false);
      }
    }

    loadQuizResults();
  }, []);

  return (
    <main className="min-h-screen bg-[var(--surface-strong)] px-6 py-16 text-[var(--text-color)]">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-[var(--card-color)] p-10 shadow-sm border border-[var(--border-color)]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--primary-color)]">Instructor quizzes</p>
            <h1 className="text-3xl font-semibold">Manage quizzes</h1>
            <p className="text-[var(--muted-color)]">Create, edit, and launch quizzes for your students.</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/dashboard/instructor/create-quiz" className="rounded-3xl border border-[var(--border-color)] bg-[var(--surface-strong)] p-6 text-center text-[var(--text-color)] shadow-sm hover:border-[var(--primary-color)] hover:bg-[var(--surface-strong)]/80">
              <h2 className="text-xl font-semibold">Create quiz</h2>
              <p className="mt-2 text-sm text-[var(--muted-color)]">Build a new quiz from scratch with questions and grading.</p>
            </Link>
            <Link href="/quizzes/manage" className="rounded-3xl border border-[var(--border-color)] bg-[var(--surface-strong)] p-6 text-center text-[var(--text-color)] shadow-sm hover:border-[var(--primary-color)] hover:bg-[var(--surface-strong)]/80">
              <h2 className="text-xl font-semibold">Manage quizzes</h2>
              <p className="mt-2 text-sm text-[var(--muted-color)]">Edit existing quizzes and review quiz settings.</p>
            </Link>
          </div>
        </section>

        <section className="rounded-3xl bg-[var(--card-color)] p-10 shadow-sm border border-[var(--border-color)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--primary-color)]">Quiz results</p>
              <h2 className="text-3xl font-semibold">Student scores</h2>
              <p className="mt-2 text-[var(--muted-color)]">Review recent quiz submissions across your courses.</p>
            </div>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-color)]">
              {quizResults.length} recent submissions
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--muted-color)]">Loading quiz results…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : quizResults.length ? (
            <div className="overflow-hidden rounded-3xl border border-[var(--border-color)]">
              <table className="min-w-full divide-y divide-[var(--border-color)] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-700">Student</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Quiz</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Course</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Score</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-700">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {quizResults.map((result) => (
                    <tr key={result.id}>
                      <td className="px-6 py-4 text-slate-900">{result.student_name ?? 'Student'}</td>
                      <td className="px-6 py-4 text-slate-900">{result.quiz_title ?? 'Quiz'}</td>
                      <td className="px-6 py-4 text-slate-600">{result.course_title ?? 'Course'}</td>
                      <td className="px-6 py-4 text-slate-900">{result.score}</td>
                      <td className="px-6 py-4 text-slate-600">{result.status}</td>
                      <td className="px-6 py-4 text-slate-600">{result.completed_at ? new Date(result.completed_at).toLocaleDateString() : 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No quiz results available yet. Students will appear here after completing a quiz.</p>
          )}
        </section>
      </div>
    </main>
  );
}
