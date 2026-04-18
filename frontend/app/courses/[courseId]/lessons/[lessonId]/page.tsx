'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import CoursePlayer from '@/components/CoursePlayer';
import CourseNavigation from '@/components/CourseNavigation';
import { fetchCourseStructure, fetchLesson } from '@/services/courses';
import type { CourseStructure, Lesson, Module } from '@/types/course';
import { useAuth } from '@/hooks/useAuth';
import ChatBot from '@/components/ChatBot';

export default function LessonPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const courseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;
  const lessonId = Array.isArray(params.lessonId) ? params.lessonId[0] : params.lessonId;

  const [course, setCourse] = useState<CourseStructure | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId || !lessonId) {
      router.push('/courses');
      return;
    }

    setLoading(true);
    setError('');

    async function loadLesson() {
      try {
        const [courseData, lessonData] = await Promise.all([
          fetchCourseStructure(courseId),
          fetchLesson(lessonId),
        ]);
        setCourse(courseData);
        setLesson(lessonData);
      } catch (err) {
        setError('Unable to load lesson. Please check your course selection and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
  }, [courseId, lessonId, router]);

  const modules = useMemo<Module[]>(() => course?.modules ?? [], [course]);

  const handleNavigateLesson = (targetLessonId: number) => {
    if (!courseId) {
      return;
    }
    router.push(`/courses/${courseId}/lessons/${targetLessonId}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Course player</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Learning interface</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Watch video lessons, track progress, and keep notes for each lesson.</p>
          </div>
          <Link
            href={`/courses/${courseId}`}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            Back to course
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading player…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">{error}</div>
        ) : !course || !lesson ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Lesson not found.</div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[2.2fr_1fr]">
            <CoursePlayer
              lesson={lesson}
              modules={modules}
              courseTitle={course.title}
              onNavigateLesson={handleNavigateLesson}
            />
            <CourseNavigation modules={modules} currentLessonId={lesson.id} onNavigate={handleNavigateLesson} />
          </div>
        )}
      </div>
      {role === 'student' && <ChatBot />}
    </main>
  );
}
