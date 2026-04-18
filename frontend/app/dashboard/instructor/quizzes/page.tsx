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
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Instructor quizzes</p>
            <h1 className="text-3xl font-semibold">Manage quizzes</h1>
            <p className="text-slate-600">Create, edit, and launch quizzes for your students.</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/dashboard/instructor/create-quiz" className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-900 shadow-sm hover:border-sky-300 hover:bg-slate-100">
              <h2 className="text-xl font-semibold">Create quiz</h2>
              <p className="mt-2 text-sm text-slate-600">Build a new quiz from scratch with questions and grading.</p>
            </Link>
            <Link href="/quizzes/manage" className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-900 shadow-sm hover:border-sky-300 hover:bg-slate-100">
              <h2 className="text-xl font-semibold">Manage quizzes</h2>
              <p className="mt-2 text-sm text-slate-600">Edit existing quizzes and review quiz settings.</p>
            </Link>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Quiz results</p>
              <h2 className="text-3xl font-semibold">Student scores</h2>
              <p className="mt-2 text-slate-600">Review recent quiz submissions across your courses.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {quizResults.length} recent submissions
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-600">Loading quiz results…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : quizResults.length ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
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
