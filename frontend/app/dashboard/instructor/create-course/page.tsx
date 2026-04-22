'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createCourse, createModule, createLesson, uploadFile } from '@/services/instructor';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface LessonDraft {
  title: string;
  video_url: string;
  video_file: File | null;
  description: string;
  duration_minutes: string;
}

export default function CreateCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [price, setPrice] = useState('0');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [status, setStatus] = useState('draft');
  const [isPublished, setIsPublished] = useState(false);
  const [objectives, setObjectives] = useState('');
  const [requirements, setRequirements] = useState('');
  const [moduleTitle, setModuleTitle] = useState('Module 1');
  const [lessons, setLessons] = useState<LessonDraft[]>([
    { title: '', video_url: '', video_file: null, description: '', duration_minutes: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createdCourseId, setCreatedCourseId] = useState<number | null>(null);

  const lessonCount = lessons.filter((lesson) => lesson.title.trim() || lesson.video_url.trim() || lesson.video_file).length;

  const handleAddLesson = () => {
    setLessons((current) => [...current, { title: '', video_url: '', video_file: null, description: '', duration_minutes: '' }]);
  };

  const handleLessonChange = (index: number, field: keyof LessonDraft, value: string | File | null) => {
    setLessons((current) =>
      current.map((lesson, idx) =>
        idx === index ? { ...lesson, [field]: value } : lesson,
      ),
    );
  };

  const handleRemoveLesson = (index: number) => {
    setLessons((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    if (!title.trim()) {
      setError('Please provide a course title.');
      setSubmitting(false);
      return;
    }

    const courseSlug = slug.trim() || slugify(title);
    const parsedPrice = Number(price) || 0;
    const objectiveList = objectives
      .split(/\r?\n|,/) // split by lines or commas
      .map((value) => value.trim())
      .filter(Boolean);
    const requirementList = requirements
      .split(/\r?\n|,/) // split by lines or commas
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const course = await createCourse({
        title: title.trim(),
        slug: courseSlug,
        short_description: shortDescription.trim() || undefined,
        description: description.trim() || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        objectives: objectiveList.length ? objectiveList : undefined,
        requirements: requirementList.length ? requirementList : undefined,
        level,
        duration_minutes: lessonCount * 10,
        visibility,
        status,
        is_published: isPublished,
        price: parsedPrice,
        category_id: null,
        tag_ids: [],
        instructor_ids: [],
        owner_id: undefined,
        is_featured: false,
      });

      const publishedLessons = lessons.filter(
        (lesson) => lesson.title.trim() && (lesson.video_url.trim() || lesson.video_file),
      );

      if (publishedLessons.length) {
        const module = await createModule({
          course_id: course.id,
          title: moduleTitle.trim() || 'Course lessons',
          description: `Lessons for ${course.title}`,
        });

        await Promise.all(
          publishedLessons.map(async (lesson) => {
            let contentType = 'external_link';
            let contentPayload: Record<string, unknown> = {
              url: lesson.video_url.trim(),
              title: lesson.title.trim(),
            };

            if (lesson.video_file) {
              const uploadResult = await uploadFile(lesson.video_file);
              contentType = 'video_upload';
              contentPayload = {
                file_url: uploadResult.url,
                mime_type: uploadResult.content_type,
                file_size_bytes: uploadResult.size,
              };
            }

            return createLesson({
              course_id: course.id,
              module_id: module.id,
              title: lesson.title.trim(),
              content: lesson.description.trim() || undefined,
              content_type: contentType,
              duration_minutes: Number(lesson.duration_minutes) || undefined,
              position: undefined,
              is_locked: false,
              is_mandatory: false,
              drip_enabled: false,
              available_at: null,
              unlock_after_days: null,
              prerequisite_ids: [],
              content_payload: contentPayload,
            });
          }),
        );
      }

      setCreatedCourseId(course.id);
      setMessage('Course created successfully. You can add lessons, quizzes, and assignments next.');
      setTitle('');
      setSlug('');
      setShortDescription('');
      setDescription('');
      setThumbnailUrl('');
      setLevel('beginner');
      setPrice('0');
      setVisibility('public');
      setStatus('draft');
      setIsPublished(false);
      setObjectives('');
      setRequirements('');
      setModuleTitle('Module 1');
      setLessons([{ title: '', video_url: '', video_file: null, description: '', duration_minutes: '' }]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to create course. Please try again.');
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
              <h1 className="mt-3 text-3xl font-semibold">Create a new course</h1>
            </div>
            <Link
              href="/dashboard/instructor/upload-lessons"
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Upload lessons later
            </Link>
          </div>

          <p className="mt-4 text-slate-600">Build your course with video lessons and connect it to quizzes and assignments for learners.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Course title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Illustrate course goals"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  required
                />
              </label>
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Course slug</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="auto-generated from title"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Short description</span>
                <input
                  value={shortDescription}
                  onChange={(event) => setShortDescription(event.target.value)}
                  placeholder="One sentence summary"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Thumbnail URL</span>
                <input
                  value={thumbnailUrl}
                  onChange={(event) => setThumbnailUrl(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </div>

            <label className="space-y-3">
              <span className="text-sm font-semibold text-slate-700">Full description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="Describe the learning outcome, modules, and course structure."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <div className="grid gap-6 lg:grid-cols-3">
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Level</span>
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as 'beginner' | 'intermediate' | 'advanced')}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Visibility</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as 'public' | 'private')}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(event) => setIsPublished(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-sky-600"
                />
                <span className="text-sm text-slate-700">Publish immediately</span>
              </label>
              <div />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Learning objectives</span>
                <textarea
                  value={objectives}
                  onChange={(event) => setObjectives(event.target.value)}
                  rows={3}
                  placeholder="One objective per line or comma-separated"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="space-y-3">
                <span className="text-sm font-semibold text-slate-700">Requirements</span>
                <textarea
                  value={requirements}
                  onChange={(event) => setRequirements(event.target.value)}
                  rows={3}
                  placeholder="Enter any prerequisites or system requirements"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Video lessons</h2>
                  <p className="text-sm text-slate-600">Add course videos and descriptions for your first module.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLesson}
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add lesson
                </button>
              </div>

              <label className="mt-6 block space-y-3">
                <span className="text-sm font-semibold text-slate-700">Module title</span>
                <input
                  value={moduleTitle}
                  onChange={(event) => setModuleTitle(event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <div className="mt-6 space-y-6">
                {lessons.map((lesson, index) => (
                  <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Lesson {index + 1}</p>
                        <p className="text-sm text-slate-500">Add title, video URL, and lesson description.</p>
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
                          placeholder="Enter lesson name"
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
                        <span className="text-sm font-medium text-slate-700">Or upload a video</span>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(event) => handleLessonChange(index, 'video_file', event.target.files?.[0] ?? null)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <p className="text-xs text-slate-500">Choose either a video file or an external video URL.</p>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Notes</span>
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
                          min="0"
                          value={lesson.duration_minutes}
                          onChange={(event) => handleLessonChange(index, 'duration_minutes', event.target.value)}
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
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {message}
                {createdCourseId ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link href={`/courses/${createdCourseId}`} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      View course
                    </Link>
                    <Link href={`/dashboard/instructor/upload-lessons?courseId=${createdCourseId}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                      Add more lessons
                    </Link>
                    <Link href="/dashboard/instructor/create-assignment" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                      Create assignment
                    </Link>
                    <Link href="/dashboard/instructor/create-quiz" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                      Create quiz
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving course...' : 'Save course and add lessons'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
