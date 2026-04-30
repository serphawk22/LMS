'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchQuizzes } from '../../services/quiz';
import type { Quiz } from '../../types/quiz';

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  useEffect(() => {
    fetchQuizzes().then(setQuizzes).catch(() => setQuizzes([]));
  }, []);

  return (
    <main className="w-full min-h-screen bg-slate-50 text-slate-900">
      <section className="w-full px-6 lg:px-10 py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Quiz Center</p>
            <h1 className="mt-3 text-3xl font-semibold">Available quizzes</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/quizzes/manage" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Manage quizzes
            </Link>
            <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              Back to home
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/quizzes/${quiz.id}`}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{quiz.title}</h2>
                  <p className="mt-2 text-slate-600">{quiz.description}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {quiz.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                <span>{quiz.total_points} points</span>
                <span>{quiz.pass_percentage}% pass rate</span>
                <span>{quiz.time_limit_minutes} min timer</span>
              </div>
            </Link>
          ))}
          {!quizzes.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              No quizzes found.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
