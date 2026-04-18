import type { Assignment, AssignmentSubmission } from '@/types/assignment';
import GradingPanel from '@/components/GradingPanel';

interface SubmissionTableProps {
  assignment: Assignment;
  submissions: AssignmentSubmission[];
  gradeData: Record<number, { grade: string; feedback: string }>;
  gradingSubmissionId: number | null;
  onGradeChange: (submissionId: number, field: 'grade' | 'feedback', value: string) => void;
  onGradeSubmit: (submission: AssignmentSubmission) => Promise<void>;
  onDownloadAttachment: (submissionId: number, filename: string) => void;
}

export default function SubmissionTable({
  assignment,
  submissions,
  gradeData,
  gradingSubmissionId,
  onGradeChange,
  onGradeSubmit,
  onDownloadAttachment,
}: SubmissionTableProps) {
  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <GradingPanel
          key={submission.id}
          submission={submission}
          gradeValue={gradeData[submission.id]?.grade ?? ''}
          feedbackValue={gradeData[submission.id]?.feedback ?? ''}
          onGradeChange={onGradeChange}
          onSubmit={async (item) => {
            await onGradeSubmit(item);
          }}
          submitting={gradingSubmissionId === submission.id}
          onDownloadAttachment={onDownloadAttachment}
        />
      ))}
    </div>
  );
}
