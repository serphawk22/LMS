'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminCommentSection from '@/components/AdminCommentSection';
import {
  fetchAdminStudentSubmissions,
  fetchAdminInstructorActivity,
  createAdminComment,
} from '@/services/dashboard';
import type {
  AdminStudentSubmissionRead,
  AdminInstructorActivityRead,
} from '@/types/dashboard';

function formatDate(dateString: string) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export default function AdminCommentsPage() {
  const [studentSubmissions, setStudentSubmissions] = useState<AdminStudentSubmissionRead[]>([]);
  const [instructorActivity, setInstructorActivity] = useState<AdminInstructorActivityRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'instructors'>('students');

  useEffect(() => {
    async function loadData() {
      try {
        const [submissionsData, activityData] = await Promise.all([
          fetchAdminStudentSubmissions(),
          fetchAdminInstructorActivity(),
        ]);
        setStudentSubmissions(submissionsData);
        setInstructorActivity(activityData);
      } catch (err: any) {
        setError(err?.message || 'Unable to load comments data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleAddComment = async (commentType: string, relatedId: number, content: string) => {
    try {
      await createAdminComment(commentType, relatedId, content);

      // Refresh data after adding comment
      if (commentType === 'assignment_submission' || commentType === 'quiz_attempt') {
        const submissionsData = await fetchAdminStudentSubmissions();
        setStudentSubmissions(submissionsData);
      } else if (commentType === 'instructor_course' || commentType === 'instructor_activity') {
        const activityData = await fetchAdminInstructorActivity();
        setInstructorActivity(activityData);
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to add comment');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white px-8 py-8 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold">Admin Comments</h1>
            <p className="mt-2 text-sm text-slate-600">Manage comments on student work and instructor performance.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              Back to admin dashboard
            </Link>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'students'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('students')}
          >
            Student Work Comments
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'instructors'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('instructors')}
          >
            Instructor Performance Comments
          </button>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading comments data…</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : (
          <>
            {/* Student Work Comments Tab */}
            {activeTab === 'students' && (
              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold">Student Work Comments</h2>
                  <p className="mt-1 text-sm text-slate-500">Review and comment on student assignments and quiz submissions.</p>
                </div>

                {studentSubmissions.length === 0 ? (
                  <p className="text-sm text-slate-500">No student submissions found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3">Assignment/Quiz</th>
                          <th className="px-4 py-3">Submission Date</th>
                          <th className="px-4 py-3">Admin Comment</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {studentSubmissions.map((submission) => (
                          <tr key={`${submission.comment_type}-${submission.related_id}`}>
                            <td className="px-4 py-4 font-medium text-slate-900">{submission.student_name}</td>
                            <td className="px-4 py-4 text-slate-600">{submission.course_title}</td>
                            <td className="px-4 py-4 text-slate-600">{submission.assignment_or_quiz}</td>
                            <td className="px-4 py-4 text-slate-600">{formatDate(submission.submission_date)}</td>
                            <td className="px-4 py-4 text-slate-600 max-w-xs truncate">
                              {submission.admin_comment || 'No comment yet'}
                            </td>
                            <td className="px-4 py-4">
                              <AdminCommentSection
                                commentType={submission.comment_type}
                                relatedId={submission.related_id}
                                existingComment={submission.admin_comment ? {
                                  id: submission.comment_id!,
                                  admin_name: 'You',
                                  content: submission.admin_comment,
                                  created_at: new Date().toISOString(),
                                } : null}
                                onCommentAdd={handleAddComment}
                                compact
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Instructor Performance Comments Tab */}
            {activeTab === 'instructors' && (
              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold">Instructor Performance Comments</h2>
                  <p className="mt-1 text-sm text-slate-500">Review and provide feedback on instructor course creation and content.</p>
                </div>

                {instructorActivity.length === 0 ? (
                  <p className="text-sm text-slate-500">No instructor activity found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-3">Instructor Name</th>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3">Lessons Uploaded</th>
                          <th className="px-4 py-3">Quizzes Created</th>
                          <th className="px-4 py-3">Admin Feedback</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {instructorActivity.map((activity) => (
                          <tr key={`${activity.comment_type}-${activity.related_id}`}>
                            <td className="px-4 py-4 font-medium text-slate-900">{activity.instructor_name}</td>
                            <td className="px-4 py-4 text-slate-600">{activity.course_title}</td>
                            <td className="px-4 py-4 text-slate-600">{activity.lessons_uploaded}</td>
                            <td className="px-4 py-4 text-slate-600">{activity.quizzes_created}</td>
                            <td className="px-4 py-4 text-slate-600 max-w-xs truncate">
                              {activity.admin_feedback || 'No feedback yet'}
                            </td>
                            <td className="px-4 py-4">
                              <AdminCommentSection
                                commentType={activity.comment_type}
                                relatedId={activity.related_id}
                                existingComment={activity.admin_feedback ? {
                                  id: activity.comment_id!,
                                  admin_name: 'You',
                                  content: activity.admin_feedback,
                                  created_at: new Date().toISOString(),
                                } : null}
                                onCommentAdd={handleAddComment}
                                compact
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}