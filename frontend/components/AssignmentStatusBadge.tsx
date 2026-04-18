import type { Assignment, AssignmentSubmission } from '@/types/assignment';

interface AssignmentStatusBadgeProps {
  assignment: Assignment;
  submission?: AssignmentSubmission | null;
}

export default function AssignmentStatusBadge({ assignment, submission }: AssignmentStatusBadgeProps) {
  const now = new Date();
  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  const isPastDue = dueDate && now > dueDate;
  const isLate = submission?.late || (isPastDue && submission && !assignment.allow_late_submission);

  if (submission?.status === 'graded') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        Graded
      </span>
    );
  }

  if (submission) {
    if (isLate) {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
          Late Submission
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
        Submitted
      </span>
    );
  }

  if (isPastDue && !assignment.allow_late_submission) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        Overdue
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
      Not Submitted
    </span>
  );
}