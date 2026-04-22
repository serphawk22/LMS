'use client';

import axios from 'axios';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchQuizAttempt } from '../../../../services/quiz';
import type { QuizAttemptAnswer, QuizAttemptRead } from '../../../../types/quiz';

interface QuizResultsPageProps {
  params: {
    attemptId: string;
  };
}

function formatAnswer(answer: QuizAttemptAnswer['student_answer']) {
  if (answer === null || answer === undefined || answer === '') {
    return 'No answer submitted';
  }
  if (Array.isArray(answer)) {
    return answer.join(', ');
  }
  if (typeof answer === 'boolean') {
    return answer ? 'True' : 'False';
  }
  if (typeof answer === 'object' && 'filename' in answer) {
    return answer.filename;
  }
  return String(answer);
}

export default function QuizResultsPage({ params }: QuizResultsPageProps) {
  const [result, setResult] = useState<QuizAttemptRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAttempt() {
      try {
        const response = await fetchQuizAttempt(Number(params.attemptId));
        setResult(response);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.detail || 'Unable to load quiz results.');
        } else {
          setError('Unable to load quiz results.');
        }
      }
    }

    void loadAttempt();
  }, [params.attemptId]);

  const totalPoints = useMemo(() => {
    if (typeof result?.total_points === 'number') {
      return result.total_points;
    }
    return (result?.answers ?? []).reduce((sum, answer) => sum + answer.points_possible, 0);
  }, [result]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <div className="w-full rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">
          {error}
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          Loading quiz results...
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-slate-50 px-6 lg:px-10 py-12 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">Quiz completed</p>
          <h1 className="mt-3 text-3xl font-semibold">{result.quiz_title ?? 'Quiz Results'}</h1>
          <p className="mt-2 text-slate-600">
            Your Score: {result.score} / {totalPoints}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Submission</p>
              <p className="mt-2 font-semibold text-slate-900">
                {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : 'Not available'}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Status</p>
              <p className="mt-2 font-semibold capitalize text-slate-900">{result.status.replace('_', ' ')}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Attempt</p>
              <p className="mt-2 font-semibold text-slate-900">
                {result.attempt_number}
                {result.max_attempts ? ` / ${result.max_attempts}` : ''}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {(result.answers ?? []).map((answer, index) => (
            <article key={answer.question_id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Question {index + 1}</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{answer.question_text}</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    answer.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {answer.points_awarded} / {answer.points_possible} pts
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Your answer</p>
                  <p className="mt-2 text-sm text-slate-600">{formatAnswer(answer.student_answer)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Correct answer</p>
                  <p className="mt-2 text-sm text-slate-600">{formatAnswer(answer.correct_answer ?? null)}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <Link
          href="/quizzes"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to quizzes
        </Link>
      </div>
    </main>
  );
}
