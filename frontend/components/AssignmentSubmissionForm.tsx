import { useState } from 'react';

interface AssignmentSubmissionFormProps {
  onSubmit: (submissionLink: string) => Promise<void>;
  initialLink?: string;
  isSubmitting?: boolean;
  submitButtonText?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function AssignmentSubmissionForm({
  onSubmit,
  initialLink = '',
  isSubmitting = false,
  submitButtonText = 'Submit assignment',
  disabled = false,
  disabledMessage = 'Submissions are closed for this assignment.',
}: AssignmentSubmissionFormProps) {
  const [submissionLink, setSubmissionLink] = useState(initialLink);

  const isValidUrl = (value: string) => {
    try {
      const url = new URL(value.trim());
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(submissionLink.trim());
  };

  if (disabled) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {disabledMessage}
      </div>
    );
  }

  const allowSubmit = submissionLink.trim().length > 0 && isValidUrl(submissionLink);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-900">Submission link</label>
        <input
          type="url"
          value={submissionLink}
          onChange={(event) => setSubmissionLink(event.target.value)}
          className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          placeholder="https://example.com/your-work"
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={isSubmitting || !allowSubmit}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? 'Submitting…' : submitButtonText}
        </button>
        <p className="text-sm text-slate-500">Submit a link to your work for grading.</p>
      </div>
    </form>
  );
}