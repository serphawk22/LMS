'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { deleteQuiz, fetchQuizzes } from '../../../services/quiz';
import type { Quiz } from '../../../types/quiz';

export default function ManageQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizzes()
      .then(setQuizzes)
      .catch(() => setError('Unable to load quizzes.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(quizId: number) {
    setError(null);
    if (!window.confirm('Delete this quiz? This cannot be undone.')) {
      return;
    }

    try {
      await deleteQuiz(quizId);
      setQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
    } catch (err) {
      setError('Unable to delete quiz. Please try again.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="w-full px-6 lg:px-10 py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold">Manage quizzes</h1>
            <p className="mt-2 text-slate-600">Edit or remove existing quizzes from your organization.</p>
          </div>
          <Link
            href="/quizzes/new"
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create quiz
          </Link>
        </div>

        {error ? <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">Loading quizzes…</div>
        ) : null}

        <div className="grid gap-6">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{quiz.title}</h2>
                  <p className="mt-2 text-slate-600">{quiz.description}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/quizzes/manage/${quiz.id}/edit`}
                    className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(quiz.id)}
                    className="rounded-full bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                <span>{quiz.total_points} points</span>
                <span>{quiz.pass_percentage}% pass rate</span>
                <span>{quiz.time_limit_minutes} min timer</span>
                <span>{quiz.published ? 'Published' : 'Draft'}</span>
              </div>
            </div>
          ))}

          {!loading && quizzes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              No quizzes have been created yet.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
