'use client';

import { useState, type FormEvent } from 'react';
import { createQuiz } from '../services/quiz';
import type { QuizCreatePayload, QuizQuestionCreate, QuizQuestionType } from '../types/quiz';

const questionTypes: { value: QuizQuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'multiple_select', label: 'Multiple select' },
  { value: 'true_false', label: 'True/False' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'long_answer', label: 'Long answer' },
  { value: 'file_upload', label: 'File upload' },
  { value: 'coding_question', label: 'Coding question' },
];

const emptyQuestion = (): QuizQuestionCreate => ({
  text: '',
  question_type: 'multiple_choice',
  choices: ['', ''],
  correct_answer: '',
  points: 1,
});

export default function QuizBuilder() {
  const [form, setForm] = useState<QuizCreatePayload>({
    course_id: 0,
    title: '',
    description: '',
    total_points: 0,
    passing_score: 0,
    pass_percentage: 0,
    time_limit_minutes: 0,
    randomize_questions: false,
    question_count: 0,
    max_attempts: 0,
    auto_grade_enabled: true,
    published: false,
    due_date: '',
    questions: [emptyQuestion()],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFieldChange<T extends keyof QuizCreatePayload>(field: T, value: QuizCreatePayload[T]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleQuestionChange(index: number, field: keyof QuizQuestionCreate, value: unknown) {
    setForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[index], [field]: value } as QuizQuestionCreate;
      updated[index] = question;
      return { ...current, questions: updated };
    });
  }

  function handleChoiceChange(questionIndex: number, choiceIndex: number, value: string) {
    setForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices || [])];
      const previousChoice = question.choices[choiceIndex];
      question.choices[choiceIndex] = value;
      if (question.question_type === 'multiple_choice' && question.correct_answer === previousChoice) {
        question.correct_answer = value;
      }
      if (question.question_type === 'multiple_select' && Array.isArray(question.correct_answer)) {
        question.correct_answer = question.correct_answer.map((item) => (item === previousChoice ? value : item));
      }
      updated[questionIndex] = question;
      return { ...current, questions: updated };
    });
  }

  function addChoice(questionIndex: number) {
    setForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices || []), ''];
      updated[questionIndex] = question;
      return { ...current, questions: updated };
    });
  }

  function removeChoice(questionIndex: number, choiceIndex: number) {
    setForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices || [])];
      const [removedChoice] = question.choices.splice(choiceIndex, 1);
      if (question.question_type === 'multiple_choice' && question.correct_answer === removedChoice) {
        question.correct_answer = '';
      }
      if (question.question_type === 'multiple_select' && Array.isArray(question.correct_answer)) {
        question.correct_answer = question.correct_answer.filter((item) => item !== removedChoice);
      }
      updated[questionIndex] = question;
      return { ...current, questions: updated };
    });
  }

  function addQuestion() {
    setForm((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }));
  }

  function removeQuestion(index: number) {
    setForm((current) => ({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  }

  function normalizeQuestions(): QuizQuestionCreate[] {
    return form.questions.map((question) => {
      const payload = { ...question };
      if (payload.question_type === 'true_false' && typeof payload.correct_answer === 'string') {
        payload.correct_answer = payload.correct_answer === 'true';
      }
      if (payload.question_type === 'multiple_select' && !Array.isArray(payload.correct_answer)) {
        payload.correct_answer = [];
      }
      if (['multiple_choice', 'short_answer', 'long_answer', 'coding_question', 'file_upload'].includes(payload.question_type) && typeof payload.correct_answer !== 'string') {
        payload.correct_answer = String(payload.correct_answer ?? '');
      }
      return payload;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const totalPoints = form.questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
    const payload: QuizCreatePayload = {
      ...form,
      total_points: totalPoints,
      questions: normalizeQuestions(),
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
    };

    try {
      const response = await createQuiz(payload);
      setSuccess(`Quiz created successfully with ID ${response.id}`);
      setForm({
        course_id: 0,
        title: '',
        description: '',
        total_points: 0,
        passing_score: 0,
        pass_percentage: 0,
        time_limit_minutes: 0,
        randomize_questions: false,
        question_count: 0,
        max_attempts: 0,
        auto_grade_enabled: true,
        published: false,
        due_date: '',
        questions: [emptyQuestion()],
      });
    } catch (err) {
      setError('Could not create the quiz. Please verify the details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-color)] p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-[var(--text-color)]">Create New Quiz</h1>
        <p className="mt-2 text-[var(--muted-color)]">Build a quiz with questions, timer, attempt limits, and grading options.</p>
      </div>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : null}
      {success ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{success}</div> : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-color)] p-6 shadow-sm">
            <label className="block text-sm font-semibold text-[var(--text-color)]">Course ID</label>
            <input
              type="number"
              value={form.course_id}
              onChange={(event) => handleFieldChange('course_id', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
            />

            <label className="mt-6 block text-sm font-semibold text-[var(--text-color)]">Quiz title</label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
              required
            />

            <label className="mt-6 block text-sm font-semibold text-[var(--text-color)]">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => handleFieldChange('description', event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
            />
          </div>

          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-color)] p-6 shadow-sm">
            <label className="block text-sm font-semibold text-[var(--text-color)]">Passing score</label>
            <input
              type="number"
              value={form.passing_score}
              onChange={(event) => handleFieldChange('passing_score', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
            />

            <label className="mt-6 block text-sm font-semibold text-[var(--text-color)]">Pass percentage</label>
            <input
              type="number"
              value={form.pass_percentage}
              onChange={(event) => handleFieldChange('pass_percentage', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
            />

            <label className="mt-6 block text-sm font-semibold text-[var(--text-color)]">Time limit (minutes)</label>
            <input
              type="number"
              value={form.time_limit_minutes}
              onChange={(event) => handleFieldChange('time_limit_minutes', Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
            />

            <label className="mt-6 block text-sm font-semibold text-[var(--text-color)]">Due date</label>
            <input
              type="datetime-local"
              value={form.due_date ?? ''}
              onChange={(event) => handleFieldChange('due_date', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text-color)] focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-color)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-color)]">Quiz settings</h2>
              <p className="text-sm text-[var(--muted-color)]">Control randomness, attempt limits, and grading mode.</p>
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Add question
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-slate-900">
              Max attempts
              <input
                type="number"
                value={form.max_attempts}
                onChange={(event) => handleFieldChange('max_attempts', Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-900">
              Question count
              <input
                type="number"
                value={form.question_count}
                onChange={(event) => handleFieldChange('question_count', Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-900">
              Randomize questions
              <select
                value={String(form.randomize_questions)}
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
                value={String(form.auto_grade_enabled)}
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
                value={String(form.published)}
                onChange={(event) => handleFieldChange('published', event.target.value === 'true')}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="false">Draft</option>
                <option value="true">Published</option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-6">
          {form.questions.map((question, index) => (
            <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Question {index + 1}</h3>
                  <p className="text-sm text-slate-600">Configure content, answer format, and scoring.</p>
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
                    required
                  />
                </label>

                <label className="space-y-2 text-sm font-semibold text-slate-900">
                  Question type
                  <select
                    value={question.question_type}
                    onChange={(event) => {
                      const value = event.target.value as QuizQuestionType;
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
                    {questionTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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
                      onClick={() => addChoice(index)}
                      className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Add choice
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(question.choices || []).map((choice, choiceIndex) => (
                      <div key={choiceIndex} className="flex items-center gap-3">
                        {question.question_type === 'multiple_choice' ? (
                          <label className="flex min-w-fit items-center gap-2 text-sm text-slate-600">
                            <input
                              type="radio"
                              name={`correct-answer-${index}`}
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
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeChoice(index, choiceIndex)}
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
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'Saving quiz…' : 'Save quiz'}
        </button>
      </form>
    </div>
  );
}
