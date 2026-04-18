'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  fetchQuizById,
  updateQuiz,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
} from '../services/quiz';
import type {
  Quiz,
  QuizQuestionEdit,
  QuizQuestionCreate,
  QuizUpdatePayload,
} from '../types/quiz';

interface QuizEditorProps {
  quizId: number;
}

const emptyQuestion = (): QuizQuestionEdit => ({
  text: '',
  question_type: 'multiple_choice',
  choices: ['', ''],
  correct_answer: '',
  points: 1,
});

export default function QuizEditor({ quizId }: QuizEditorProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [form, setForm] = useState<QuizUpdatePayload>({});
  const [questions, setQuestions] = useState<QuizQuestionEdit[]>([]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionSuccess, setQuestionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizById(quizId)
      .then((data) => {
        setQuiz(data);
        setForm({
          course_id: data.course_id,
          title: data.title,
          description: data.description ?? '',
          passing_score: data.passing_score,
          pass_percentage: data.pass_percentage,
          time_limit_minutes: data.time_limit_minutes,
          randomize_questions: data.randomize_questions,
          question_count: data.question_count,
          max_attempts: data.max_attempts,
          auto_grade_enabled: data.auto_grade_enabled,
          published: data.published,
          due_date: data.due_date ?? '',
        });
        setQuestions(
          data.questions.map((question) => ({
            ...question,
            choices: question.choices ?? [''],
            correct_answer: question.correct_answer ?? '',
          }))
        );
      })
      .catch(() => setError('Unable to load quiz.'))
      .finally(() => setLoading(false));
  }, [quizId]);

  const formattedDueDate = useMemo(() => {
    if (!quiz?.due_date) return '';
    const date = new Date(quiz.due_date);
    return date.toISOString().slice(0, 16);
  }, [quiz?.due_date]);

  function handleFieldChange<T extends keyof QuizUpdatePayload>(field: T, value: QuizUpdatePayload[T]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleQuestionChange(index: number, field: keyof QuizQuestionEdit, value: unknown) {
    setQuestions((current) => {
      const updated = [...current];
      updated[index] = { ...updated[index], [field]: value } as QuizQuestionEdit;
      return updated;
    });
  }

  function handleChoiceChange(questionIndex: number, choiceIndex: number, value: string) {
    setQuestions((current) => {
      const updated = [...current];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices ?? [])];
      const previousChoice = question.choices[choiceIndex];
      question.choices[choiceIndex] = value;
      if (question.question_type === 'multiple_choice' && question.correct_answer === previousChoice) {
        question.correct_answer = value;
      }
      if (question.question_type === 'multiple_select' && Array.isArray(question.correct_answer)) {
        question.correct_answer = question.correct_answer.map((item) => (item === previousChoice ? value : item));
      }
      updated[questionIndex] = question;
      return updated;
    });
  }

  function addQuestion() {
    setQuestions((current) => [...current, emptyQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) => {
      const removed = current[index];
      if (removed.id) {
        setDeletedQuestionIds((ids) => [...ids, removed.id!]);
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function normalizeQuestion(question: QuizQuestionEdit | QuizQuestionCreate) {
    const normalized: QuizQuestionCreate = {
      text: question.text,
      question_type: question.question_type,
      choices: question.choices,
      correct_answer: question.correct_answer,
      points: question.points,
    };

    if (normalized.question_type === 'true_false' && typeof normalized.correct_answer === 'string') {
      normalized.correct_answer = normalized.correct_answer === 'true';
    }

    if (normalized.question_type === 'multiple_select' && !Array.isArray(normalized.correct_answer)) {
      normalized.correct_answer = [];
    }

    if (
      ['multiple_choice', 'short_answer', 'long_answer', 'coding_question', 'file_upload'].includes(
        normalized.question_type
      ) && typeof normalized.correct_answer !== 'string'
    ) {
      normalized.correct_answer = String(normalized.correct_answer ?? '');
    }

    return normalized;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await updateQuiz(quizId, {
        ...form,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      });
      setSuccess('Quiz updated successfully.');
    } catch (err) {
      setError('Unable to update the quiz.');
    }
  }

  async function handleSaveQuestions() {
    setQuestionError(null);
    setQuestionSuccess(null);
    setQuestionSaving(true);

    try {
      await Promise.all(
        deletedQuestionIds.map((questionId) => deleteQuizQuestion(questionId))
      );

      const savedQuestions = await Promise.all(
        questions.map(async (question) => {
          const payload = normalizeQuestion(question);
          if (question.id) {
            return updateQuizQuestion(question.id, payload);
          }
          return createQuizQuestion(quizId, payload);
        })
      );

      const refreshed = await fetchQuizById(quizId);
      setQuiz(refreshed);
      setQuestions(
        refreshed.questions.map((question) => ({
          ...question,
          choices: question.choices ?? [''],
          correct_answer: question.correct_answer ?? '',
        }))
      );
      setDeletedQuestionIds([]);
      setQuestionSuccess('Question bank saved successfully.');
      if (!quiz) setQuiz(refreshed);
    } catch (err) {
      setQuestionError('Unable to save quiz questions.');
    } finally {
      setQuestionSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">Loading quiz…</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">Quiz not found.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Edit quiz</h1>
        <p className="mt-2 text-slate-600">Update metadata, timing, scoring, and questions for this quiz.</p>
      </div>

      {error ? <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}
      {success ? <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{success}</div> : null}
      {questionError ? <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{questionError}</div> : null}
      {questionSuccess ? <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{questionSuccess}</div> : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Course ID
            <input
              type="number"
              value={form.course_id ?? ''}
              onChange={(event) => handleFieldChange('course_id', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Quiz title
            <input
              type="text"
              value={form.title ?? ''}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>

        <label className="space-y-2 text-sm font-semibold text-slate-900">
          Description
          <textarea
            value={form.description ?? ''}
            onChange={(event) => handleFieldChange('description', event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <div className="grid gap-6 lg:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Passing score
            <input
              type="number"
              value={form.passing_score ?? 0}
              onChange={(event) => handleFieldChange('passing_score', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Pass percentage
            <input
              type="number"
              value={form.pass_percentage ?? 0}
              onChange={(event) => handleFieldChange('pass_percentage', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Question count
            <input
              type="number"
              value={form.question_count ?? 0}
              onChange={(event) => handleFieldChange('question_count', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Time limit (minutes)
            <input
              type="number"
              value={form.time_limit_minutes ?? 0}
              onChange={(event) => handleFieldChange('time_limit_minutes', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Max attempts
            <input
              type="number"
              value={form.max_attempts ?? 0}
              onChange={(event) => handleFieldChange('max_attempts', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Due date
            <input
              type="datetime-local"
              value={form.due_date ?? formattedDueDate}
              onChange={(event) => handleFieldChange('due_date', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Randomize questions
            <select
              value={String(form.randomize_questions ?? false)}
              onChange={(event) => handleFieldChange('randomize_questions', event.target.value === 'true')}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Auto grade enabled
            <select
              value={String(form.auto_grade_enabled ?? true)}
              onChange={(event) => handleFieldChange('auto_grade_enabled', event.target.value === 'true')}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            Published
            <select
              value={String(form.published ?? false)}
              onChange={(event) => handleFieldChange('published', event.target.value === 'true')}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="false">Draft</option>
              <option value="true">Published</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Save changes
        </button>
      </form>

      <section className="mt-12 space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Edit questions</h2>
              <p className="mt-2 text-slate-600">Add, remove, or refine questions for this quiz.</p>
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Add question
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id ?? index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Question {index + 1}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-900">
                  Question text
                  <input
                    type="text"
                    value={question.text}
                    onChange={(event) => handleQuestionChange(index, 'text', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="space-y-2 text-sm font-semibold text-slate-900">
                  Question type
                  <select
                    value={question.question_type}
                    onChange={(event) => {
                      const value = event.target.value as QuizQuestionEdit['question_type'];
                      handleQuestionChange(index, 'question_type', value);
                      if (value === 'multiple_choice' || value === 'multiple_select') {
                        handleQuestionChange(index, 'choices', question.choices?.length ? question.choices : ['', '']);
                        handleQuestionChange(index, 'correct_answer', value === 'multiple_select' ? [] : '');
                      } else if (value === 'true_false') {
                        handleQuestionChange(index, 'choices', []);
                        handleQuestionChange(index, 'correct_answer', 'true');
                      } else {
                        handleQuestionChange(index, 'choices', []);
                        handleQuestionChange(index, 'correct_answer', '');
                      }
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="multiple_select">Multiple select</option>
                    <option value="true_false">True/False</option>
                    <option value="short_answer">Short answer</option>
                    <option value="long_answer">Long answer</option>
                    <option value="file_upload">File upload</option>
                    <option value="coding_question">Coding question</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-semibold text-slate-900">
                  Points
                  <input
                    type="number"
                    value={question.points}
                    onChange={(event) => handleQuestionChange(index, 'points', Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    min={0}
                  />
                </label>
              </div>

              {['multiple_choice', 'multiple_select'].includes(question.question_type) ? (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Choices</p>
                    <button
                      type="button"
                      onClick={() => {
                        const currentChoices = question.choices ?? [];
                        handleQuestionChange(index, 'choices', [...currentChoices, '']);
                      }}
                      className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Add choice
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(question.choices ?? []).map((choice, choiceIndex) => (
                      <div key={choiceIndex} className="flex items-center gap-3">
                        {question.question_type === 'multiple_choice' ? (
                          <label className="flex min-w-fit items-center gap-2 text-sm text-slate-600">
                            <input
                              type="radio"
                              name={`edit-correct-answer-${index}`}
                              checked={question.correct_answer === choice}
                              onChange={() => handleQuestionChange(index, 'correct_answer', choice)}
                              className="h-4 w-4 border-slate-300 text-sky-600"
                            />
                            Correct
                          </label>
                        ) : (
                          <label className="flex min-w-fit items-center gap-2 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={Array.isArray(question.correct_answer) && question.correct_answer.includes(choice)}
                              onChange={() => {
                                const selected = Array.isArray(question.correct_answer) ? question.correct_answer : [];
                                handleQuestionChange(
                                  index,
                                  'correct_answer',
                                  selected.includes(choice)
                                    ? selected.filter((item) => item !== choice)
                                    : [...selected, choice]
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-sky-600"
                            />
                            Correct
                          </label>
                        )}
                        <input
                          type="text"
                          value={choice}
                          onChange={(event) => handleChoiceChange(index, choiceIndex, event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                          placeholder={`Choice ${choiceIndex + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const currentChoices = question.choices ?? [];
                            const removedChoice = currentChoices[choiceIndex];
                            const newChoices = currentChoices.filter((_, idx) => idx !== choiceIndex);
                            handleQuestionChange(index, 'choices', newChoices);
                            if (question.question_type === 'multiple_choice' && question.correct_answer === removedChoice) {
                              handleQuestionChange(index, 'correct_answer', '');
                            }
                            if (question.question_type === 'multiple_select' && Array.isArray(question.correct_answer)) {
                              handleQuestionChange(
                                index,
                                'correct_answer',
                                question.correct_answer.filter((item) => item !== removedChoice)
                              );
                            }
                          }}
                          className="rounded-full bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="mt-6 block text-sm font-semibold text-slate-900">
                Correct answer
                {question.question_type === 'true_false' ? (
                  <select
                    value={String(question.correct_answer ?? 'true')}
                    onChange={(event) => handleQuestionChange(index, 'correct_answer', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : ['multiple_choice', 'multiple_select'].includes(question.question_type) ? (
                  <p className="mt-2 text-sm font-normal text-slate-500">
                    {question.question_type === 'multiple_choice'
                      ? 'Select the correct option using the radio button beside a choice.'
                      : 'Select every correct option using the checkboxes beside the choices.'}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={String(question.correct_answer ?? '')}
                    onChange={(event) => handleQuestionChange(index, 'correct_answer', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder={
                      question.question_type === 'file_upload'
                        ? 'Expected filename or reference'
                        : 'Expected answer'
                    }
                  />
                )}
              </label>
            </div>
          ))}

          {questions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              No questions configured yet. Add a question to get started.
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={questionSaving}
          onClick={handleSaveQuestions}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {questionSaving ? 'Saving questions…' : 'Save questions'}
        </button>
      </section>
    </div>
  );
}
