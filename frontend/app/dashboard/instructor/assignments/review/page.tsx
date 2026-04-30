'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchAssignment,
  fetchAssignmentSubmissions,
  getAssignmentSubmissionAttachmentUrl,
  gradeAssignmentSubmission,
} from '@/services/assignments';
import type { Assignment, AssignmentSubmission, AssignmentGradePayload } from '@/types/assignment';

export default function AssignmentsReviewPage() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [gradingSubmissionId, setGradingSubmissionId] = useState<number | null>(null);
  const [gradeData, setGradeData] = useState<Record<number, { grade: string; feedback: string }>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!assignmentId) {
      setError('No assignment selected.');
      setLoading(false);
      return;
    }

    async function loadAssignment() {
      setLoading(true);
      setError('');
      try {
        const assignmentData = await fetchAssignment(Number(assignmentId));
        setAssignment(assignmentData);
        const result = await fetchAssignmentSubmissions(assignmentData.id);
        setSubmissions(result);
      } catch {
        setError('Unable to load assignment.');
      } finally {
        setLoading(false);
      }
    }

    loadAssignment();
  }, [assignmentId]);

  const handleGradeChange = (submissionId: number, field: 'grade' | 'feedback', value: string) => {
    setGradeData((current) => ({
      ...current,
      [submissionId]: {
        grade: field === 'grade' ? value : current[submissionId]?.grade ?? '',
        feedback: field === 'feedback' ? value : current[submissionId]?.feedback ?? '',
      },
    }));
  };

  const handleGradeSubmit = async (submission: AssignmentSubmission) => {
    const gradeForm = gradeData[submission.id];
    if (!gradeForm?.grade) {
      setError('Grade value is required.');
      return;
    }

    setError('');
    setSuccess('');
    setGradingSubmissionId(submission.id);

    try {
      const payload: AssignmentGradePayload = {
        grade: Number(gradeForm.grade),
        feedback: gradeForm.feedback,
        status: 'graded',
      };
      const updated = await gradeAssignmentSubmission(submission.id, payload);
      setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSuccess('Submission graded successfully.');
    } catch {
      setError('Unable to grade submission.');
    } finally {
      setGradingSubmissionId(null);
    }
  };

  const handleDownloadAttachment = async (submissionId: number, filename: string) => {
    setError('');
    try {
      const url = await getAssignmentSubmissionAttachmentUrl(submissionId, filename);
      window.open(url, '_blank');
    } catch {
      setError('Unable to download attachment.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Instructor assignments</p>
              <h1 className="text-3xl font-semibold">Review submissions</h1>
            </div>
            <div className="text-sm text-slate-500">Review and grade student submissions.</div>
          </div>

          {error ? <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div> : null}
          {success ? <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{success}</div> : null}
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Submissions</h2>
            <p className="mt-2 text-sm text-slate-600">Review and grade student uploads for the selected assignment.</p>
          </div>

          {assignment ? (
            <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{assignment.title}</p>
              <p className="mt-2 text-sm text-slate-600">{assignment.instructions ?? 'No assignment instructions provided.'}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString()}` : 'No due date'}</span>
                <span>{assignment.allow_late_submission ? 'Late submissions allowed' : 'No late submissions'}</span>
                <span>{assignment.published ? 'Published' : 'Draft'}</span>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-slate-500">Loading assignment…</div>
          ) : submissions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">No submissions yet.</div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Student ID: {submission.user_id}</p>
                      <p className="mt-1 text-sm text-slate-500">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
                      <p className="mt-2 text-sm text-slate-600">Status: {submission.status} {submission.late ? '• Late' : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {submission.grade !== null ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Score {submission.grade}</span>
                      ) : null}
                      {submission.feedback ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Feedback added</span>
                      ) : null}
                    </div>
                  </div>

                  {submission.content ? (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Submission link</p>
                      <a
                        href={submission.content}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-sm text-sky-600 hover:underline"
                      >
                        {submission.content}
                      </a>
                    </div>
                  ) : null}

                  {submission.attachments && submission.attachments.length > 0 ? (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Attachments</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        {submission.attachments.map((attachment) => (
                          <li key={attachment.filename}>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(submission.id, attachment.filename)}
                              className="text-sky-600 hover:underline"
                            >
                              {attachment.filename}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Score
                        <input
                          type="number"
                          value={gradeData[submission.id]?.grade ?? ''}
                          onChange={(event) => handleGradeChange(submission.id, 'grade', event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          min="0"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Feedback
                        <textarea
                          value={gradeData[submission.id]?.feedback ?? ''}
                          onChange={(event) => handleGradeChange(submission.id, 'feedback', event.target.value)}
                          rows={2}
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGradeSubmit(submission)}
                      disabled={gradingSubmissionId === submission.id}
                      className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {gradingSubmissionId === submission.id ? 'Saving…' : 'Save grade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
