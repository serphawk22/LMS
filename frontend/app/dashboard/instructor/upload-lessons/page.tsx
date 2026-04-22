'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchInstructorCourses, fetchCourseStructure, createModule, createLesson, CourseData } from '@/services/instructor';
import type { CourseStructure } from '@/types/course';

interface LessonDraft {
  title: string;
  video_url: string;
  description: string;
  duration_minutes: string;
}

export default function UploadLessonsPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseStructure, setCourseStructure] = useState<CourseStructure | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | 'new' | null>('new');
  const [newModuleTitle, setNewModuleTitle] = useState('New module');
  const [lessons, setLessons] = useState<LessonDraft[]>([
    { title: '', video_url: '', description: '', duration_minutes: '' },
  ]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCourses() {
      try {
        const result = await fetchInstructorCourses();
        setCourses(result);
        if (result.length) {
          setSelectedCourseId(result[0].id);
        }
      } catch (err) {
        setError('Unable to load your courses.');
      } finally {
        setLoadingCourses(false);
      }
    }

    loadCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseStructure(null);
      return;
    }

    setLoadingStructure(true);
    setError('');
    fetchCourseStructure(selectedCourseId)
      .then(setCourseStructure)
      .catch(() => setError('Unable to load course structure.'))
      .finally(() => setLoadingStructure(false));
  }, [selectedCourseId]);

  const handleLessonChange = (index: number, field: keyof LessonDraft, value: string) => {
    setLessons((current) => current.map((lesson, idx) => (idx === index ? { ...lesson, [field]: value } : lesson)));
  };

  const handleAddLesson = () => {
    setLessons((current) => [...current, { title: '', video_url: '', description: '', duration_minutes: '' }]);
  };

  const handleRemoveLesson = (index: number) => {
    setLessons((current) => current.filter((_, idx) => idx !== index));
  };

  const targetCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const moduleOptions = courseStructure?.modules ?? [];

  const handleCourseChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = Number(event.target.value);
    setSelectedCourseId(courseId || null);
    setSelectedModuleId('new');
    setNewModuleTitle('New module');
    setMessage('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    if (!selectedCourseId) {
      setError('Please choose a course first.');
      setSubmitting(false);
      return;
    }

    const validLessons = lessons.filter((lesson) => lesson.title.trim() && lesson.video_url.trim());
    if (!validLessons.length) {
      setError('Add at least one lesson with a title and video URL.');
      setSubmitting(false);
      return;
    }

    try {
      const moduleId =
        selectedModuleId === 'new' || selectedModuleId === null
          ? (await createModule({
              course_id: selectedCourseId,
              title: newModuleTitle.trim() || `Module ${moduleOptions.length + 1}`,
              description: `Additional lessons for ${targetCourse?.title ?? 'your course'}`,
            })).id
          : selectedModuleId;

      await Promise.all(
        validLessons.map((lesson) =>
          createLesson({
            course_id: selectedCourseId,
            module_id: moduleId,
            title: lesson.title.trim(),
            content: lesson.description.trim() || undefined,
            content_type: 'external_link',
            duration_minutes: Number(lesson.duration_minutes) || undefined,
            position: undefined,
            is_locked: false,
            is_mandatory: false,
            drip_enabled: false,
            available_at: null,
            unlock_after_days: null,
            prerequisite_ids: [],
            content_payload: {
              url: lesson.video_url.trim(),
              title: lesson.title.trim(),
            },
          })
        )
      );

      setMessage('Video lessons added successfully.');
      setLessons([{ title: '', video_url: '', description: '', duration_minutes: '' }]);
      setSelectedModuleId('new');
      setNewModuleTitle('New module');
      setCourseStructure(await fetchCourseStructure(selectedCourseId));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to add lessons.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Instructor</p>
              <h1 className="mt-3 text-3xl font-semibold">Upload video lessons</h1>
            </div>
            <Link
              href="/dashboard/instructor/create-course"
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create new course
            </Link>
          </div>

          <p className="mt-4 text-slate-600">Select one of your courses and attach video lessons that students can watch after enrollment.</p>

          {loadingCourses ? (
            <div className="mt-8 rounded-3xl bg-slate-100 p-8 text-slate-600">Loading courses…</div>
          ) : courses.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-700">
              No courses found. Create a course first and return to add lessons.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              <div className="grid gap-6 lg:grid-cols-2">
                <label className="space-y-3">
                  <span className="text-sm font-semibold text-slate-700">Choose course</span>
                  <select
                    value={selectedCourseId ?? ''}
                    onChange={handleCourseChange}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-3">
                  <span className="text-sm font-semibold text-slate-700">Choose module</span>
                  <select
                    value={selectedModuleId === 'new' ? 'new' : selectedModuleId ?? 'new'}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedModuleId(value === 'new' ? 'new' : Number(value));
                    }}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="new">Create a new module</option>
                    {moduleOptions.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedModuleId === 'new' ? (
                <label className="space-y-3">
                  <span className="text-sm font-semibold text-slate-700">New module title</span>
                  <input
                    value={newModuleTitle}
                    onChange={(event) => setNewModuleTitle(event.target.value)}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              ) : null}

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Lesson builder</h2>
                    <p className="text-sm text-slate-600">Add one or more video lessons for the selected course.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLesson}
                    className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Add lesson
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  {lessons.map((lesson, index) => (
                    <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Lesson {index + 1}</p>
                          <p className="text-sm text-slate-500">Add a title, video URL, and description.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLesson(index)}
                          className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-5 grid gap-4">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Lesson title</span>
                          <input
                            value={lesson.title}
                            onChange={(event) => handleLessonChange(index, 'title', event.target.value)}
                            placeholder="Lesson name"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Video URL</span>
                          <input
                            value={lesson.video_url}
                            onChange={(event) => handleLessonChange(index, 'video_url', event.target.value)}
                            placeholder="https://..."
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Lesson notes</span>
                          <textarea
                            value={lesson.description}
                            onChange={(event) => handleLessonChange(index, 'description', event.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Duration (minutes)</span>
                          <input
                            type="number"
                            value={lesson.duration_minutes}
                            onChange={(event) => handleLessonChange(index, 'duration_minutes', event.target.value)}
                            min="0"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
              ) : null}
              {message ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Saving lessons...' : 'Add lessons to course'}
              </button>
            </form>
          )}

          {selectedCourseId && courseStructure ? (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Current course modules</h2>
              {loadingStructure ? (
                <p className="mt-4 text-sm text-slate-600">Loading modules…</p>
              ) : moduleOptions.length ? (
                <div className="mt-4 grid gap-4">
                  {moduleOptions.map((module) => (
                    <div key={module.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{module.title}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {module.lessons.length} lessons
                        </span>
                      </div>
                      {module.description ? <p className="mt-2 text-sm text-slate-600">{module.description}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No modules have been created for this course yet.</p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
