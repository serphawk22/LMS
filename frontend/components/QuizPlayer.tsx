'use client';

import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchQuizAttempts,
  fetchQuizByCourseId,
  fetchQuizById,
  startQuizByCourseId,
  startQuizById,
  submitQuiz,
} from '../services/quiz';
import type { Quiz, QuizAnswer, QuizAttemptRead, QuizAttemptStart, QuizQuestion } from '../types/quiz';

interface QuizPlayerProps {
  courseId?: number;
  quizId?: number;
}

type QuizState = 'idle' | 'active' | 'submitted';

export default function QuizPlayer({ courseId, quizId }: QuizPlayerProps) {
  const router = useRouter();
  const autoSubmittingRef = useRef(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<QuizAttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<number, QuizAnswer['answer']>>({});
  const [existingSubmission, setExistingSubmission] = useState<QuizAttemptRead | null>(null);
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSubmissionState, setLoadingSubmissionState] = useState(true);

  useEffect(() => {
    async function loadQuiz() {
      try {
        let data: Quiz;
        if (quizId) {
          data = await fetchQuizById(quizId);
        } else if (courseId) {
          data = await fetchQuizByCourseId(courseId);
        } else {
          throw new Error('Either quizId or courseId is required');
        }
        setQuiz(data);
      } catch (err) {
        const errorMsg = getErrorMessage(err, 'Unable to load quiz.');
        setError(
          errorMsg.includes('submission time has ended')
            ? 'Quiz submission time has ended. You cannot take this quiz anymore.'
            : errorMsg
        );
      }
    }

    loadQuiz();
  }, [courseId, quizId]);

  useEffect(() => {
    if (!quiz) {
      return;
    }
    const currentQuiz = quiz;

    async function loadSubmissionState() {
      setLoadingSubmissionState(true);
      try {
        const attempts = await fetchQuizAttempts(50, 0);
        const submittedAttempt = attempts
          .filter((item) => item.quiz_id === currentQuiz.id && item.submitted_at)
          .sort((left, right) => {
            const leftTime = left.submitted_at ? new Date(left.submitted_at).getTime() : 0;
            const rightTime = right.submitted_at ? new Date(right.submitted_at).getTime() : 0;
            return rightTime - leftTime;
          })[0];

        if (submittedAttempt && currentQuiz.max_attempts === 1) {
          setExistingSubmission(submittedAttempt);
          setQuizState('submitted');
        } else {
          setExistingSubmission(null);
        }
      } catch {
        // Leave the quiz playable if we cannot preload submission history.
      } finally {
        setLoadingSubmissionState(false);
      }
    }

    loadSubmissionState();
  }, [quiz]);

  useEffect(() => {
    if (!attempt || !attempt.expires_at) {
      setTimeLeft(null);
      return;
    }

    autoSubmittingRef.current = false;
    const deadline = new Date(attempt.expires_at).getTime();
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !autoSubmittingRef.current) {
        autoSubmittingRef.current = true;
        window.clearInterval(interval);
        void handleSubmit(true);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [attempt, answers]);

  const formattedTimeLeft = useMemo(() => {
    if (timeLeft === null) return null;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

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

  function updateAnswer(questionId: number, value: QuizAnswer['answer']) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function isQuestionAnswerMissing(question: QuizQuestion, answer: QuizAnswer['answer']) {
    if (answer === undefined || answer === null) {
      return true;
    }
    if (typeof answer === 'string' && answer.trim() === '') {
      return true;
    }
    if (question.question_type === 'multiple_select') {
      return !Array.isArray(answer) || answer.length === 0;
    }
    if (question.question_type === 'file_upload') {
      return typeof answer !== 'object' || answer === null || !('filename' in answer) || !answer.filename;
    }
    return false;
  }

  const unansweredQuestionCount = useMemo(() => {
    if (!attempt) {
      return 0;
    }

    return attempt.questions.reduce((count, question) => {
      if (isQuestionAnswerMissing(question, answers[question.id])) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [attempt, answers]);

  async function handleStart() {
    if (quizState === 'submitted') {
      return;
    }

    setError(null);
    setIsStarting(true);
    try {
      let started: QuizAttemptStart;
      if (quizId) {
        started = await startQuizById(quizId);
      } else if (courseId) {
        started = await startQuizByCourseId(courseId);
      } else {
        throw new Error('Either quizId or courseId is required');
      }
      setAttempt(started);
      setAnswers({});
      setQuizState('active');
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Unable to start quiz. Please check your tenant and authentication.');
      setError(
        errorMsg.includes('Maximum number of quiz attempts reached.')
          ? 'You have already submitted this quiz.'
          : errorMsg.includes('submission time has ended')
            ? 'Quiz submission time has ended. You cannot take this quiz anymore.'
            : errorMsg.includes('will be available starting')
              ? errorMsg
              : errorMsg
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSubmit(isAutoSubmit = false) {
    if (!attempt || !quiz) {
      return;
    }

    const unansweredQuestions = attempt.questions.filter((question) =>
      isQuestionAnswerMissing(question, answers[question.id])
    );

    if (!isAutoSubmit && unansweredQuestions.length > 0) {
      setError(
        `Please answer all ${unansweredQuestions.length} quiz question${
          unansweredQuestions.length === 1 ? '' : 's'
        } before submitting.`
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const payload = attempt.questions.map((question) => ({
      question_id: question.id,
      answer:
        answers[question.id] ??
        (question.question_type === 'multiple_select' ? [] : null),
    }));

    try {
      const response = await submitQuiz(quiz.id, attempt.attempt_id, payload as QuizAnswer[]);
      setExistingSubmission(response);
      setAttempt(null);
      setQuizState('submitted');
      if (isAutoSubmit) {
        setError('Time limit reached. Your quiz was automatically submitted.');
      }
      router.push(`/quizzes/results/${response.id}`);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isAutoSubmit ? 'Automatic submission failed.' : 'Unable to submit quiz answers.'
        )
      );
      autoSubmittingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderInput(question: QuizQuestion) {
    const value = answers[question.id] ?? (question.question_type === 'multiple_select' ? [] : '');

    if (question.question_type === 'multiple_choice') {
      return (
        <div className="space-y-2">
          {question.choices?.map((choice) => (
            <label key={choice} className="flex items-center gap-2">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={choice}
                checked={value === choice}
                onChange={() => updateAnswer(question.id, choice)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <span>{choice}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.question_type === 'multiple_select') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {question.choices?.map((choice) => (
            <label key={choice} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(choice)}
                onChange={() => {
                  const next = selected.includes(choice)
                    ? selected.filter((item) => item !== choice)
                    : [...selected, choice];
                  updateAnswer(question.id, next);
                }}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <span>{choice}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.question_type === 'true_false') {
      return (
        <div className="space-y-2">
          {['true', 'false'].map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={value === (option === 'true')}
                onChange={() => updateAnswer(question.id, option === 'true')}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <span>{option === 'true' ? 'True' : 'False'}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.question_type === 'file_upload') {
      return (
        <input
          type="file"
          accept="*/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            updateAnswer(question.id, {
              filename: file.name,
              content: btoa(unescape(encodeURIComponent(text))),
              mimeType: file.type,
            });
          }}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      );
    }

    return (
      <textarea
        value={String(value ?? '')}
        onChange={(event) => updateAnswer(question.id, event.target.value)}
        rows={question.question_type === 'long_answer' || question.question_type === 'coding_question' ? 6 : 3}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />
    );
  }

  return (
    <div className="w-full space-y-8 px-6 lg:px-10 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{quiz?.title ?? 'Quiz'}</h1>
            <p className="mt-2 text-slate-600">{quiz?.description}</p>
          </div>
          {attempt && formattedTimeLeft ? (
            <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sky-700">Time left: {formattedTimeLeft}</div>
          ) : null}
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</p> : null}

      {quizState === 'submitted' && existingSubmission ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h2 className="text-xl font-semibold">You have already submitted this quiz</h2>
          <p className="mt-2 text-sm">
            Attempt {existingSubmission.attempt_number} was submitted on{' '}
            {existingSubmission.submitted_at
              ? new Date(existingSubmission.submitted_at).toLocaleString()
              : 'an earlier session'}
            .
          </p>
          <button
            type="button"
            onClick={() => router.push(`/quizzes/results/${existingSubmission.id}`)}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View results
          </button>
        </div>
      ) : null}

      {!attempt && quizState !== 'submitted' ? (
        <button
          type="button"
          onClick={handleStart}
          disabled={isStarting || loadingSubmissionState}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loadingSubmissionState ? 'Checking quiz status...' : isStarting ? 'Starting...' : 'Start Quiz'}
        </button>
      ) : null}

      {attempt ? (
        <div className="space-y-6">
          {attempt.questions.map((question, index) => (
            <div key={question.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Question {index + 1}</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{question.text}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
                  {question.points} pts
                </span>
              </div>
              <div className="mt-4">{renderInput(question)}</div>
            </div>
          ))}

          <div className="space-y-3">
            {unansweredQuestionCount > 0 ? (
              <p className="text-sm text-rose-700">
                You have {unansweredQuestionCount} unanswered question
                {unansweredQuestionCount === 1 ? '' : 's'}.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              disabled={isSubmitting || unansweredQuestionCount > 0}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answers'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
