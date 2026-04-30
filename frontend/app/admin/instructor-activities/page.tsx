'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminCommentSection from '@/components/AdminCommentSection';
import {
  fetchAdminInstructorActivitySummary,
  fetchAdminInstructorActivityDetails,
} from '@/services/dashboard';
import type {
  AdminInstructorActivitySummary,
  AdminInstructorActivityDetails,
} from '@/types/dashboard';

function formatDate(dateString?: string | null) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
}

export default function AdminInstructorActivitiesPage() {
  const [instructors, setInstructors] = useState<AdminInstructorActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState<AdminInstructorActivitySummary | null>(null);
  const [details, setDetails] = useState<AdminInstructorActivityDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  useEffect(() => {
    async function loadInstructors() {
      try {
        const data = await fetchAdminInstructorActivitySummary();
        setInstructors(data);
      } catch (err: any) {
        setError(err?.message || 'Unable to load instructor activity.');
      } finally {
        setLoading(false);
      }
    }

    loadInstructors();
  }, []);

  async function openActivity(instructor: AdminInstructorActivitySummary) {
    setSelectedInstructor(instructor);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);

    try {
      const data = await fetchAdminInstructorActivityDetails(instructor.user_id);
      setDetails(data);
    } catch (err: any) {
      setDetailsError(err?.message || 'Unable to load activity details.');
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeActivity() {
    setSelectedInstructor(null);
    setDetails(null);
    setDetailsError('');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white px-8 py-8 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold">Instructor Activity Monitoring</h1>
            <p className="mt-2 text-sm text-slate-600">Review instructor engagement, content creation, and student enrollment metrics.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              Back to admin dashboard
            </Link>
          </div>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">All instructors</h2>
              <p className="mt-1 text-sm text-slate-500">Instructors are listed with course, lesson, quiz, assignment, and student enrollment metrics.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading instructors…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : instructors.length === 0 ? (
            <p className="text-sm text-slate-500">No instructors found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100">
                  <tr className="divide-x divide-slate-200">
                    <th className="px-6 py-3 font-semibold text-slate-700">Instructor Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Email</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Courses Created</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Lessons Uploaded</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Quizzes Created</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Assignments Created</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Students Enrolled</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {instructors.map((instructor) => (
                    <tr key={instructor.user_id} className="divide-x divide-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium">{instructor.full_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{instructor.email || 'N/A'}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{instructor.courses_created}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{instructor.lessons_uploaded}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{instructor.quizzes_created}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{instructor.assignments_created}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{instructor.students_enrolled}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openActivity(instructor)}
                          className="inline-block rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Details Modal */}
        {selectedInstructor && (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
                <div>
                  <h2 className="text-2xl font-semibold">{selectedInstructor.full_name || 'Instructor'}</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedInstructor.email}</p>
                </div>
                <button
                  onClick={closeActivity}
                  className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              {detailsLoading ? (
                <div className="px-8 py-12 text-center">
                  <p className="text-slate-500">Loading details…</p>
                </div>
              ) : detailsError ? (
                <div className="px-8 py-12 text-center">
                  <p className="text-rose-600">{detailsError}</p>
                </div>
              ) : details ? (
                <div className="space-y-8 px-8 py-8 max-h-[70vh] overflow-y-auto">
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">Total Courses</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{details.courses.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">Total Lessons</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{details.lessons.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">Students Enrolled</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{details.total_students_enrolled}</p>
                    </div>
                  </div>

                  {/* Courses Section */}
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Courses Created ({details.courses.length})</h3>
                    {details.courses.length === 0 ? (
                      <p className="text-sm text-slate-500">No courses created.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {details.courses.map((course) => (
                          <div key={course.course_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{course.title}</p>
                              <p className="text-xs text-slate-500">
                                Status: <span className="font-semibold capitalize">{course.status}</span>
                                {course.is_published && <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Published</span>}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500">{formatDate(course.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lessons Section */}
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Lessons Uploaded ({details.lessons.length})</h3>
                    {details.lessons.length === 0 ? (
                      <p className="text-sm text-slate-500">No lessons uploaded.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {details.lessons.map((lesson) => (
                          <div key={lesson.lesson_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{lesson.title}</p>
                              <p className="text-xs text-slate-600">{lesson.course_title}</p>
                            </div>
                            <p className="text-xs text-slate-500">{formatDate(lesson.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quizzes Section */}
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Quizzes Created ({details.quizzes.length})</h3>
                    {details.quizzes.length === 0 ? (
                      <p className="text-sm text-slate-500">No quizzes created.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-100">
                            <tr>
                              <th className="px-3 py-2 font-semibold text-slate-700">Quiz Title</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Course</th>
                              <th className="px-3 py-2 text-right font-semibold text-slate-700">Questions</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {details.quizzes.map((quiz) => (
                              <tr key={quiz.quiz_id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium">{quiz.title}</td>
                                <td className="px-3 py-2 text-slate-600">{quiz.course_title}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{quiz.question_count}</td>
                                <td className="px-3 py-2 text-slate-500">{formatDate(quiz.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Assignments Section */}
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Assignments Created ({details.assignments.length})</h3>
                    {details.assignments.length === 0 ? (
                      <p className="text-sm text-slate-500">No assignments created.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-100">
                            <tr>
                              <th className="px-3 py-2 font-semibold text-slate-700">Assignment Title</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Course</th>
                              <th className="px-3 py-2 text-right font-semibold text-slate-700">Max Score</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {details.assignments.map((assignment) => (
                              <tr key={assignment.assignment_id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium">{assignment.title}</td>
                                <td className="px-3 py-2 text-slate-600">{assignment.course_title}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{assignment.max_score}</td>
                                <td className="px-3 py-2 text-slate-500">{formatDate(assignment.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Instructor Courses Comments Section */}
                  <AdminCommentSection
                    commentType="instructor_course"
                    relatedId={selectedInstructor.user_id}
                    title={`${selectedInstructor.full_name || 'Instructor'}'s Courses`}
                  />

                  {/* Instructor Activity Comments Section */}
                  <AdminCommentSection
                    commentType="instructor_activity"
                    relatedId={selectedInstructor.user_id}
                    title={`${selectedInstructor.full_name || 'Instructor'}'s Activity`}
                  />
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
