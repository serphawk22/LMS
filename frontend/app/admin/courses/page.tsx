'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createCourse, deleteCourse, fetchCourses, updateCourse } from '@/services/courses';
import { fetchAdminCourseAnalytics } from '@/services/dashboard';
import { listOrganizationUsers } from '@/services/organizations';
import type { CourseDetails, CoursePayload } from '@/types/course';
import type { UserProfile } from '@/types/auth';

const emptyForm: CoursePayload = {
  title: '',
  slug: '',
  short_description: '',
  description: '',
  thumbnail_url: '',
  objectives: [],
  requirements: [],
  level: 'beginner',
  duration_minutes: 0,
  visibility: 'private',
  status: 'draft',
  is_published: false,
  price: 0,
  category_id: null,
  tag_ids: [],
  instructor_ids: [],
  owner_id: null,
  is_featured: false,
};

function normalizeRole(role: string | undefined): string {
  return (role || '').toLowerCase().replace(/\s+/g, '_');
}

function buildSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseDetails[]>([]);
  const [instructors, setInstructors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [form, setForm] = useState<CoursePayload>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredInstructors = useMemo(
    () =>
      instructors.filter((user) => {
        const role = normalizeRole(user.role_name || user.role);
        return ['instructor', 'organization_admin', 'admin', 'super_admin'].includes(role);
      }),
    [instructors],
  );

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError('');
      try {
        const [courseList, userList] = await Promise.all([fetchCourses(), listOrganizationUsers()]);
        setInstructors(userList);

        const coursesWithCounts = await Promise.all(
          courseList.map(async (course) => {
            try {
              const analytics = await fetchAdminCourseAnalytics(course.id);
              return {
                ...course,
                students_enrolled: analytics.total_students,
                lessons_count: analytics.total_lessons,
                quizzes_count: analytics.quiz_performance?.length ?? 0,
              };
            } catch {
              return {
                ...course,
                students_enrolled: 0,
                lessons_count: 0,
                quizzes_count: 0,
              };
            }
          }),
        );

        setCourses(coursesWithCounts);
      } catch {
        setError('Unable to load admin courses. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, []);

  const resetForm = () => {
    setEditingCourseId(null);
    setForm({ ...emptyForm });
    setSuccess('');
    setError('');
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (course: CourseDetails) => {
    setEditingCourseId(course.id);
    setForm({
      title: course.title,
      slug: course.slug ?? '',
      short_description: course.short_description ?? '',
      description: course.description ?? '',
      thumbnail_url: course.thumbnail_url ?? '',
      objectives: course.objectives ?? [],
      requirements: course.requirements ?? [],
      level: course.level ?? 'beginner',
      duration_minutes: course.duration_minutes ?? 0,
      visibility: course.visibility ?? 'private',
      status: course.status ?? 'draft',
      is_published: course.is_published ?? false,
      price: course.price ?? 0,
      category_id: typeof course.category === 'object' ? course.category?.id ?? null : null,
      tag_ids: [],
      instructor_ids: course.instructors?.map((instructor) => instructor.id ?? 0).filter(Boolean) ?? [],
      owner_id: course.owner_id ?? null,
      is_featured: course.is_featured ?? false,
    });
    setSuccess('');
    setError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (courseId: number) => {
    if (!confirm('Delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteCourse(courseId);
      setCourses((current) => current.filter((course) => course.id !== courseId));
      setSuccess('Course deleted successfully.');
      setError('');
      if (editingCourseId === courseId) {
        resetForm();
      }
    } catch {
      setError('Unable to delete course.');
      setSuccess('');
    }
  };

  const reloadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const courseList = await fetchCourses();
      const coursesWithCounts = await Promise.all(
        courseList.map(async (course) => {
          try {
            const analytics = await fetchAdminCourseAnalytics(course.id);
            return {
              ...course,
              students_enrolled: analytics.total_students,
              lessons_count: analytics.total_lessons,
              quizzes_count: analytics.quiz_performance?.length ?? 0,
            };
          } catch {
            return {
              ...course,
              students_enrolled: 0,
              lessons_count: 0,
              quizzes_count: 0,
            };
          }
        }),
      );
      setCourses(coursesWithCounts);
    } catch {
      setError('Unable to refresh course list.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      setError('Course title and slug are required.');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        short_description: form.short_description,
        description: form.description,
        instructor_ids: form.instructor_ids?.filter(Boolean) ?? [],
      };

      if (editingCourseId) {
        await updateCourse(editingCourseId, payload);
        setSuccess('Course updated successfully.');
      } else {
        await createCourse(payload);
        setSuccess('Course created successfully.');
      }

      await reloadCourses();
      resetForm();
    } catch {
      setError('Unable to save course. Please check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        (course.short_description ?? '').toLowerCase().includes(query);

      const matchesInstructor =
        !selectedInstructorId ||
        course.instructors?.some((instructor) => instructor.id === selectedInstructorId);

      return matchesSearch && matchesInstructor;
    });
  }, [courses, searchQuery, selectedInstructorId]);

  const pageCount = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold">Course Management</h1>
          <p className="mt-2 text-slate-600">Manage your organization’s course catalog, instructors, and course-level metrics.</p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_0.9fr] w-full">
              <label className="min-w-0">
                <span className="sr-only">Search courses</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search courses"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="min-w-0">
                <span className="sr-only">Filter by instructor</span>
                <select
                  value={selectedInstructorId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedInstructorId(value ? Number(value) : '');
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">All instructors</option>
                  {filteredInstructors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="self-start rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create Course
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
        ) : null}

        {success ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{success}</div>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Instructor</th>
                  <th className="px-4 py-3 font-semibold">Students</th>
                  <th className="px-4 py-3 font-semibold">Lessons</th>
                  <th className="px-4 py-3 font-semibold">Quizzes</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Loading courses…
                    </td>
                  </tr>
                ) : paginatedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No courses match your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedCourses.map((course) => (
                    <tr key={course.id}>
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-slate-900">{course.title}</div>
                        <div className="mt-1 max-w-sm text-xs text-slate-500 line-clamp-2">{course.short_description ?? 'No description'}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-600">
                        {course.instructors?.length ? course.instructors.map((instructor) => instructor.full_name).join(', ') : 'Unassigned'}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-600">{course.students_enrolled ?? 0}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{course.lessons_count ?? 0}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{course.quizzes_count ?? 0}</td>
                      <td className="px-4 py-4 align-top text-slate-600">{course.created_at ? new Date(course.created_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-4 align-top text-slate-600">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(course)}
                            className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(course.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                          <Link
                            href={`/courses/${course.id}`}
                            className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
            <p className="text-sm text-slate-500">Showing {Math.min(filteredCourses.length, pageSize)} of {filteredCourses.length} courses</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page)}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${page === currentPage ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => handlePageChange(currentPage + 1)}
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-900/20">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{editingCourseId ? 'Edit course' : 'Create Course'}</h2>
                <p className="mt-2 text-sm text-slate-500">Add or update course details and assign instructors.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">Course Title</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  onBlur={() => {
                    if (!form.slug.trim() && form.title.trim()) {
                      setForm((prev) => ({ ...prev, slug: buildSlug(prev.title) }));
                    }
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Enter course title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Course Slug</label>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="course-title-slug"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Short Description</label>
                <textarea
                  value={form.short_description}
                  onChange={(event) => setForm((prev) => ({ ...prev, short_description: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  rows={2}
                  placeholder="Enter a brief course summary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Full Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  rows={4}
                  placeholder="Add course details, outcomes, and topics covered"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Assign Instructor</label>
                <select
                  multiple
                  value={form.instructor_ids?.map(String) ?? []}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions, (option) => Number(option.value));
                    setForm((prev) => ({ ...prev, instructor_ids: selected }));
                  }}
                  className="mt-2 h-40 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {filteredInstructors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.role_name || user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? 'Saving…' : editingCourseId ? 'Save changes' : 'Create course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
