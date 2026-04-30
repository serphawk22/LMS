'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LiveClassForm from '@/components/LiveClassForm';
import { fetchInstructorCourses, type CourseData } from '@/services/instructor';

export default function CreateLiveClassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseParam = searchParams.get('course_name');

  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (courseParam) {
      setSelectedCourse(courseParam);
    }
  }, [courseParam]);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);
        const data = await fetchInstructorCourses();
        setCourses(data);
      } catch (err) {
        setError('Unable to load your courses. Please refresh.');
        console.error('Failed to fetch instructor courses', err);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, []);

  if (!selectedCourse) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-[var(--text-color)] mb-6">Schedule New Live Class</h1>
          <div className="bg-[var(--card-color)] p-6 rounded-lg shadow border border-[var(--border-color)]">
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-color)] mb-2">
                Select Course <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading courses…</div>
              ) : error ? (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">{error}</div>
              ) : courses.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No courses found. Please create a course first.</div>
              ) : (
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Select a course to schedule your live class
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.title}>
                      {course.title}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-sm text-gray-500 mt-2">
                Choose one of your existing courses. The selected course will be associated with the live class.
              </p>
            </div>

            <button
              disabled={!selectedCourse || loading || !!error}
              onClick={() => selectedCourse && setSelectedCourse(selectedCourse)}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-500 text-white font-medium py-2 px-4 rounded-md transition"
            >
              Continue to Schedule
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedCourseData = courses.find(c => c.title === selectedCourse);
  const courseName = selectedCourse || '';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => setSelectedCourse('')}
            className="text-blue-500 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Change Course
          </button>
        </div>
        <LiveClassForm courseName={courseName} onSuccess={() => {
          router.push('/dashboard/instructor/live-classes');
        }} />
      </div>
    </div>
  );
}
