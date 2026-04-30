import api from '@/lib/api';
import type {
  Assignment,
  AssignmentSubmission,
  AssignmentSubmissionCreate,
  AssignmentPayload,
  AssignmentGradePayload,
} from '@/types/assignment';

export async function fetchAssignments(courseId?: number): Promise<Assignment[]> {
  const params = courseId ? { course_id: courseId } : undefined;
  const response = await api.get('/assignments', { params });
  return response.data;
}

export async function fetchStudentAssignments(): Promise<(Assignment & { submission?: AssignmentSubmission })[]> {
  const response = await api.get('/assignments/student');
  return response.data;
}

export async function fetchInstructorAssignments(): Promise<Assignment[]> {
  const response = await api.get('/assignments?instructor=true');
  return response.data;
}

export async function fetchAssignment(assignmentId: string | number): Promise<Assignment> {
  const response = await api.get(`/assignments/${assignmentId}`);
  return response.data;
}

export async function createAssignment(payload: AssignmentPayload): Promise<Assignment> {
  const response = await api.post('/assignments', payload);
  return response.data;
}

export async function createAssignmentWithFiles(
  payload: AssignmentPayload,
  files?: FileList | File[],
): Promise<Assignment> {
  const formData = new FormData();
  formData.append('course_id', payload.course_id.toString());
  formData.append('title', payload.title);
  if (payload.instructions) formData.append('instructions', payload.instructions);
  if (payload.due_date) formData.append('due_date', payload.due_date);
  if (payload.max_score !== undefined) formData.append('max_score', payload.max_score.toString());
  formData.append('published', payload.published ? 'true' : 'false');
  formData.append('allow_late_submission', payload.allow_late_submission ? 'true' : 'false');

  if (!payload.course_id || !payload.title?.trim()) {
    throw new Error('Course and title are required to create an assignment.');
  }

  if (files) {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    fileArray.forEach((file) => {
      formData.append('attachments', file, file.name);
    });
  }

  const response = await api.post('/assignments/create-with-files', formData, {
    headers: {
      'Content-Type': undefined,
    },
  });
  return response.data;
}

export async function submitAssignment(
  assignmentId: string | number,
  submissionLink: string,
): Promise<AssignmentSubmission> {
  if (!submissionLink?.trim()) {
    throw new Error('Submission link is required.');
  }

  const formData = new FormData();
  formData.append('assignment_id', String(assignmentId));
  formData.append('submission_link', submissionLink.trim());

  const response = await api.post(`/assignments/${assignmentId}/submit`, formData);
  return response.data;
}

/**
 * @deprecated Use submitAssignment instead. This function is kept for backward compatibility.
 */
export async function submitAssignmentWithFiles(
  assignmentId: string | number,
  payload: AssignmentSubmissionCreate,
): Promise<AssignmentSubmission> {
  return submitAssignment(assignmentId, payload.submissionLink || payload.content || '');
}

export async function fetchAssignmentSubmissions(
  assignmentId: number,
): Promise<AssignmentSubmission[]> {
  const response = await api.get(`/assignments/${assignmentId}/submissions`);
  return response.data;
}

export async function fetchMyAssignmentSubmission(
  assignmentId: string | number,
): Promise<AssignmentSubmission> {
  const response = await api.get(`/assignments/${assignmentId}/submissions/me`);
  return response.data;
}

export async function getAssignmentSubmissionAttachmentUrl(
  submissionId: number,
  filename: string,
): Promise<string> {
  const response = await api.get(`/assignments/submissions/${submissionId}/attachments/${encodeURIComponent(filename)}/download`);
  return response.data.url;
}

export async function gradeAssignmentSubmission(
  submissionId: number,
  payload: AssignmentGradePayload,
): Promise<AssignmentSubmission> {
  const response = await api.post(`/assignments/submissions/${submissionId}/grade`, payload);
  return response.data;
}
