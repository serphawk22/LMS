'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminCommentSection from '@/components/AdminCommentSection';
import {
  fetchAdminStudentActivitySummary,
  fetchAdminStudentActivityDetails,
} from '@/services/dashboard';
import type {
  AdminStudentActivitySummary,
  AdminStudentActivityDetails,
} from '@/types/dashboard';

function formatDate(dateString?: string | null) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export default function AdminStudentActivitiesPage() {
  const [students, setStudents] = useState<AdminStudentActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentActivitySummary | null>(null);
  const [details, setDetails] = useState<AdminStudentActivityDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  useEffect(() => {
    async function loadStudents() {
      try {
        const data = await fetchAdminStudentActivitySummary();
        setStudents(data);
      } catch (err: any) {
        setError(err?.message || 'Unable to load student activity.');
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  async function openActivity(student: AdminStudentActivitySummary) {
    setSelectedStudent(student);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);

    try {
      const data = await fetchAdminStudentActivityDetails(student.user_id);
      setDetails(data);
    } catch (err: any) {
      setDetailsError(err?.message || 'Unable to load activity details.');
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeActivity() {
    setSelectedStudent(null);
    setDetails(null);
    setDetailsError('');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white px-8 py-8 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold">Student Activity Monitoring</h1>
            <p className="mt-2 text-sm text-slate-600">Review platform-wide student engagement, progress, and activity details.</p>
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
              <h2 className="text-xl font-semibold">All students</h2>
              <p className="mt-1 text-sm text-slate-500">Students are listed with enrollment, quiz, assignment, and progress metrics.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading students…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-500">No students found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Courses Enrolled</th>
                    <th className="px-4 py-3">Assignments Submitted</th>
                    <th className="px-4 py-3">Quizzes Attempted</th>
                    <th className="px-4 py-3">Completion Progress</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {students.map((student) => (
                    <tr key={student.user_id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{student.full_name || 'Unknown Student'}</td>
                      <td className="px-4 py-4 text-slate-600">{student.email || '—'}</td>
                      <td className="px-4 py-4">{student.courses_enrolled}</td>
                      <td className="px-4 py-4">{student.assignments_submitted}</td>
                      <td className="px-4 py-4">{student.quizzes_attempted}</td>
                      <td className="px-4 py-4">
                        <div className="mb-1 text-xs font-semibold text-slate-700">{student.completion_progress.toFixed(0)}%</div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(Math.max(student.completion_progress, 0), 100)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(student.last_login)}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => openActivity(student)}
                        >
                          View Activity
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold">{selectedStudent.full_name || 'Student activity'}</h3>
                <p className="text-sm text-slate-500">{selectedStudent.email || 'No email available'}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onClick={closeActivity}
              >
                Close
              </button>
            </div>
            <div className="space-y-6 p-6">
              {detailsLoading ? (
                <p className="text-sm text-slate-500">Loading activity details…</p>
              ) : detailsError ? (
                <p className="text-sm text-rose-600">{detailsError}</p>
              ) : details ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Overall course progress</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{details.overall_progress.toFixed(0)}%</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Courses enrolled</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{details.courses.length}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Quiz attempts</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{details.quiz_attempts.length}</p>
                    </div>
                  </div>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">Courses enrolled</h4>
                      <span className="text-sm text-slate-500">{details.courses.length} course(s)</span>
                    </div>
                    {details.courses.length === 0 ? (
                      <p className="text-sm text-slate-500">No course enrollments available.</p>
                    ) : (
                      <div className="space-y-4">
                        {details.courses.map((course) => (
                          <div key={course.course_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">{course.title}</p>
                                <p className="text-sm text-slate-500">Status: {course.status}</p>
                              </div>
                              <div className="text-sm text-slate-500">
                                Enrolled {course.enrolled_at ? formatDate(course.enrolled_at) : 'unknown'}
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-sm text-slate-500">
                                <span>Progress</span>
                                <span>{course.progress.toFixed(0)}%</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(Math.max(course.progress, 0), 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">Quiz scores</h4>
                      <span className="text-sm text-slate-500">{details.quiz_attempts.length} attempt(s)</span>
                    </div>
                    {details.quiz_attempts.length === 0 ? (
                      <p className="text-sm text-slate-500">No quiz attempts recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3">Quiz</th>
                              <th className="px-4 py-3">Course</th>
                              <th className="px-4 py-3">Score</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Completed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {details.quiz_attempts.map((attempt) => (
                              <tr key={attempt.attempt_id}>
                                <td className="px-4 py-3">{attempt.quiz_title || 'Unknown quiz'}</td>
                                <td className="px-4 py-3">{attempt.course_title || 'Unknown course'}</td>
                                <td className="px-4 py-3">{attempt.score.toFixed(1)}</td>
                                <td className="px-4 py-3">{attempt.passed ? 'Passed' : 'Failed'}</td>
                                <td className="px-4 py-3">{attempt.completed_at ? formatDate(attempt.completed_at) : 'Pending'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">Assignment submissions</h4>
                      <span className="text-sm text-slate-500">{details.assignment_submissions.length} submission(s)</span>
                    </div>
                    {details.assignment_submissions.length === 0 ? (
                      <p className="text-sm text-slate-500">No assignment submissions recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3">Assignment</th>
                              <th className="px-4 py-3">Course</th>
                              <th className="px-4 py-3">Grade</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Submitted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {details.assignment_submissions.map((submission) => (
                              <tr key={submission.submission_id}>
                                <td className="px-4 py-3">{submission.assignment_title || 'Unknown assignment'}</td>
                                <td className="px-4 py-3">{submission.course_title || 'Unknown course'}</td>
                                <td className="px-4 py-3">{submission.grade !== null && submission.grade !== undefined ? submission.grade.toFixed(1) : 'N/A'}</td>
                                <td className="px-4 py-3">{submission.status}</td>
                                <td className="px-4 py-3">{submission.submitted_at ? formatDate(submission.submitted_at) : 'Unknown'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* Quiz Comments Section */}
                  <AdminCommentSection
                    commentType="quiz_attempt"
                    relatedId={selectedStudent.user_id}
                    title={`${selectedStudent.full_name || 'Student'}'s Quiz Performance`}
                  />

                  {/* Assignment Comments Section */}
                  <AdminCommentSection
                    commentType="assignment_submission"
                    relatedId={selectedStudent.user_id}
                    title={`${selectedStudent.full_name || 'Student'}'s Assignments`}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
