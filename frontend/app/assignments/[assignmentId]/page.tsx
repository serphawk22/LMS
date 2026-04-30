'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AssignmentSubmissionPage from '@/components/AssignmentSubmissionPage';
import {
  fetchAssignment,
  fetchMyAssignmentSubmission,
  getAssignmentSubmissionAttachmentUrl,
  submitAssignment,
} from '@/services/assignments';
import type { Assignment, AssignmentSubmission } from '@/types/assignment';

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params?.assignmentId ? (Array.isArray(params.assignmentId) ? params.assignmentId[0] : params.assignmentId) : null;
  const validAssignmentId = assignmentId ?? ''; // Ensure assignmentId is a string

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!validAssignmentId) {
      router.push('/assignments');
      return;
    }

    async function loadAssignment() {
      try {
        const [assignmentData, submissionData] = await Promise.all([
          fetchAssignment(validAssignmentId),
          fetchMyAssignmentSubmission(validAssignmentId).catch(() => null),
        ]);

        setAssignment(assignmentData);
        if (submissionData) {
          setSubmission(submissionData);
        }
      } catch {
        setStatusMessage('Unable to load assignment details.');
      } finally {
        setLoading(false);
      }
    }

    loadAssignment();
  }, [validAssignmentId, router]);

  const handleDownloadAttachment = async (submissionId: number, filename: string) => {
    try {
      const url = await getAssignmentSubmissionAttachmentUrl(submissionId, filename);
      window.open(url, '_blank');
    } catch {
      setStatusMessage('Unable to download attachment.');
    }
  };

  const isPastDeadline = assignment?.due_date ? new Date() > new Date(assignment.due_date) : false;
  const disableSubmission = Boolean(
    submission?.status === 'graded' ||
      (assignment && assignment.due_date && isPastDeadline && !assignment.allow_late_submission),
  );

  return (
    <main className="w-full min-h-screen bg-slate-50 px-6 lg:px-10 py-16 text-slate-900">
      <div className="w-full space-y-8">
        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading assignment…</div>
        ) : assignment ? (
          <AssignmentSubmissionPage
            assignment={assignment}
            submission={submission}
            statusMessage={statusMessage}
            submitting={submitting}
            disableSubmission={disableSubmission}
            onDownloadAttachment={handleDownloadAttachment}
            onSubmit={async (submissionLink) => {
              setSubmitting(true);
              setStatusMessage('');
              try {
                const result = await submitAssignment(validAssignmentId, submissionLink);
                setSubmission(result);
                setStatusMessage('Assignment submitted successfully.');
              } catch (err: any) {
                setStatusMessage(err?.response?.data?.detail || 'Failed to submit assignment. Please try again.');
              } finally {
                setSubmitting(false);
              }
            }}
          />
        ) : (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">Assignment not found.</div>
        )}
      </div>
    </main>
  );
}
