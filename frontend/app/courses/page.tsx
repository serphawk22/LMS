'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCourses } from '@/services/courses';
import type { Course } from '@/types/course';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCourses() {
      try {
        const result = await fetchCourses();
        setCourses(result);
      } catch (err) {
        setError('Unable to load courses.');
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, []);

  const filteredCourses = search
    ? courses.filter((course) =>
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.description?.toLowerCase().includes(search.toLowerCase())
      )
    : courses;

  const getCourseCategoryLabel = (course: Course) =>
    typeof course.category === 'object'
      ? course.category?.name ?? 'Course'
      : course.category ?? 'Course';

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Catalog</p>
              <h1 className="mt-3 text-3xl font-semibold">Browse available courses</h1>
            </div>
            <div className="w-full sm:w-96">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search courses by title or description"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading courses…</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-sky-500 hover:shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{getCourseCategoryLabel(course)}</p>
                  {course.average_rating ? (
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{course.average_rating.toFixed(1)} ★</span>
                  ) : null}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">{course.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{course.description ?? 'No description available.'}</p>
                <p className="mt-5 text-sm font-semibold text-slate-900">View course details →</p>
              </Link>
            ))}
            {!filteredCourses.length && !loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-slate-500">No courses match your search.</div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
