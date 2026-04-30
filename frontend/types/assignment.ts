export interface AssignmentAttachment {
  filename: string;
  mime_type: string;
  size?: number;
  url?: string;
  key?: string;
}

export interface Assignment {
  id: number;
  course_id: number;
  course_name: string;
  title: string;
  instructions?: string;
  due_date?: string;
  max_score: number;
  published: boolean;
  allow_late_submission: boolean;
  attachments?: AssignmentAttachment[];
  created_at: string;
  updated_at: string;
  submissions_count: number;
  submission?: AssignmentSubmission;
}

export interface AssignmentSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  student_name?: string;
  submission_type?: string;
  submitted_at: string;
  content?: string;
  attachments?: AssignmentAttachment[];
  grade?: number;
  feedback?: string;
  status: string;
  late: boolean;
  graded_at?: string;
  graded_by?: number;
}

export interface AssignmentPayload {
  course_id: number;
  title: string;
  instructions?: string;
  due_date?: string;
  max_score?: number;
  published?: boolean;
  allow_late_submission?: boolean;
  attachments?: AssignmentAttachment[];
}

export interface AssignmentGradePayload {
  grade: number;
  feedback?: string;
  status?: string;
}

export interface AssignmentSubmissionCreate {
  submissionLink?: string;
  content?: string;
  attachments?: AssignmentAttachment[];
}
