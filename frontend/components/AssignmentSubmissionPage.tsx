import AssignmentStatusBadge from '@/components/AssignmentStatusBadge';
import AssignmentSubmissionForm from '@/components/AssignmentSubmissionForm';
import type { Assignment, AssignmentSubmission } from '@/types/assignment';

interface AssignmentSubmissionPageProps {
  assignment: Assignment;
  submission: AssignmentSubmission | null;
  statusMessage: string;
  submitting: boolean;
  disableSubmission: boolean;
  onSubmit: (submissionLink: string) => Promise<void>;
  onDownloadAttachment: (submissionId: number, filename: string) => void;
}

export default function AssignmentSubmissionPage({
  assignment,
  submission,
  statusMessage,
  submitting,
  disableSubmission,
  onSubmit,
  onDownloadAttachment,
}: AssignmentSubmissionPageProps) {
  return (
    <div className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Assignment</p>
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            <h1 className="text-3xl font-semibold">{assignment.title}</h1>
            <AssignmentStatusBadge assignment={assignment} submission={submission} />
          </div>
        </div>
        <div className="space-y-1 text-right text-sm text-slate-600">
          <p>Max score: {assignment.max_score}</p>
          {assignment.due_date ? <p>Due {new Date(assignment.due_date).toLocaleDateString()}</p> : <p>No due date</p>}
          <p>{assignment.allow_late_submission ? 'Late submissions allowed' : 'Late submissions closed on due date'}</p>
        </div>
      </div>

      {statusMessage ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{statusMessage}</div>
      ) : null}

      <div className="mt-8 space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Instructions</h2>
          <p className="mt-3 text-slate-700">{assignment.instructions ?? 'No instructions provided.'}</p>
        </div>

        {assignment.attachments && assignment.attachments.length > 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-900">Assignment files</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {assignment.attachments.map((attachment) => (
                <li key={attachment.filename}>{attachment.filename}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {submission ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Your most recent submission</p>
                <p className="mt-1 text-sm text-slate-600">
                  Status: {submission.status}{submission.late ? ' • Late' : ''}
                </p>
              </div>
              {submission.grade !== null ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Score {submission.grade}</span>
              ) : null}
            </div>

            {submission.feedback ? (
              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Instructor feedback</p>
                <p className="mt-2 text-sm text-slate-700">{submission.feedback}</p>
              </div>
            ) : null}

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
                <p className="text-sm font-semibold text-slate-900">Submitted files</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {submission.attachments.map((attachment) => (
                    <li key={attachment.filename}>
                      <button
                        type="button"
                        onClick={() => onDownloadAttachment(submission.id, attachment.filename)}
                        className="text-sky-600 hover:underline"
                      >
                        {attachment.filename}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <AssignmentSubmissionForm
          onSubmit={onSubmit}
          initialLink={submission?.content || ''}
          isSubmitting={submitting}
          submitButtonText={submission ? 'Update submission' : 'Submit assignment'}
          disabled={disableSubmission}
          disabledMessage="Late submissions are closed for this assignment."
        />
      </div>
    </div>
  );
}
