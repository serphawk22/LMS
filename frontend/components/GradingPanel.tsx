import type { AssignmentSubmission, AssignmentGradePayload } from '@/types/assignment';

interface GradingPanelProps {
  submission: AssignmentSubmission;
  gradeValue: string;
  feedbackValue: string;
  onGradeChange: (submissionId: number, field: 'grade' | 'feedback', value: string) => void;
  onSubmit: (submission: AssignmentSubmission) => Promise<void>;
  submitting: boolean;
  onDownloadAttachment: (submissionId: number, filename: string) => void;
}

export default function GradingPanel({
  submission,
  gradeValue,
  feedbackValue,
  onGradeChange,
  onSubmit,
  submitting,
  onDownloadAttachment,
}: GradingPanelProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Student ID: {submission.user_id}</p>
          <p className="mt-1 text-sm text-slate-500">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
          <p className="mt-2 text-sm text-slate-600">Status: {submission.status}{submission.late ? ' • Late' : ''}</p>
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
          {submission.content.startsWith('http://') || submission.content.startsWith('https://') ? (
            <a
              href={submission.content}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-sm text-sky-600 hover:underline"
            >
              {submission.content}
            </a>
          ) : (
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{submission.content}</p>
          )}
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

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Score
            <input
              type="number"
              value={gradeValue}
              onChange={(event) => onGradeChange(submission.id, 'grade', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              min="0"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Feedback
            <textarea
              value={feedbackValue}
              onChange={(event) => onGradeChange(submission.id, 'feedback', event.target.value)}
              rows={2}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => onSubmit(submission)}
          disabled={submitting}
          className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Saving…' : 'Save grade'}
        </button>
      </div>
    </div>
  );
}
