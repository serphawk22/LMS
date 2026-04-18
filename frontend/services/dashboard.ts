import api from '@/lib/api';
import type {
  AdminDashboardOverview,
  AdminStudentActivitySummary,
  AdminStudentActivityDetails,
  AdminInstructorActivitySummary,
  AdminInstructorActivityDetails,
  AdminComment,
  AdminStudentSubmissionRead,
  AdminInstructorActivityRead,
  DashboardOverview,
  DashboardNotificationItem,
  DailyLearningVideo,
  WeeklyStats,
} from '@/types/dashboard';
import type { CourseAnalytics } from '@/types/course';

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const response = await api.get('/dashboard/overview');
  return response.data;
}

export async function fetchAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const response = await api.get('/dashboard/admin/overview');
  return response.data;
}

export async function fetchWeeklyStats(): Promise<WeeklyStats> {
  const response = await api.get('/student/weekly-stats');
  return response.data;
}

export async function fetchAdminStudentActivitySummary(): Promise<AdminStudentActivitySummary[]> {
  const response = await api.get('/dashboard/admin/students');
  return response.data;
}

export async function fetchAdminStudentActivityDetails(userId: number): Promise<AdminStudentActivityDetails> {
  const response = await api.get(`/dashboard/admin/students/${userId}`);
  return response.data;
}

export async function fetchAdminInstructorActivitySummary(): Promise<AdminInstructorActivitySummary[]> {
  const response = await api.get('/dashboard/admin/instructors');
  return response.data;
}

export async function fetchAdminInstructorActivityDetails(instructorId: number): Promise<AdminInstructorActivityDetails> {
  const response = await api.get(`/dashboard/admin/instructors/${instructorId}`);
  return response.data;
}

export async function fetchAdminComments(commentType: string, relatedId: number): Promise<AdminComment[]> {
  const response = await api.get(`/dashboard/admin/comments/${commentType}/${relatedId}`);
  return response.data;
}

export async function createAdminComment(
  commentType: string,
  relatedId: number,
  content: string
): Promise<AdminComment> {
  const response = await api.post(`/dashboard/admin/comments/${commentType}/${relatedId}`, { content });
  return response.data;
}

export async function fetchAdminStudentSubmissions(): Promise<AdminStudentSubmissionRead[]> {
  const response = await api.get('/dashboard/admin/student-submissions');
  return response.data;
}

export async function fetchAdminInstructorActivity(): Promise<AdminInstructorActivityRead[]> {
  const response = await api.get('/dashboard/admin/instructor-activity');
  return response.data;
}

export async function fetchAdminCourseAnalytics(courseId: number): Promise<CourseAnalytics> {
  const response = await api.get(`/dashboard/admin/courses/${courseId}/analytics`);
  return response.data;
}

export async function fetchStudentNotifications(): Promise<DashboardNotificationItem[]> {
  const response = await api.get('/notifications');
  return response.data;
}

export async function fetchDailyLearningVideos(): Promise<DailyLearningVideo[]> {
  const response = await api.get('/dashboard/daily-videos');
  return response.data;
}

export async function uploadDailyLearningVideo(
  title: string,
  description: string,
  videoFile?: File | null,
  vimeoUrl?: string,
): Promise<DailyLearningVideo> {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);

  if (videoFile) {
    formData.append('video_file', videoFile);
  }
  if (vimeoUrl) {
    formData.append('vimeo_url', vimeoUrl);
  }

  console.log('Uploading daily learning video:', {
    title: title.trim(),
    description: description.trim(),
    hasVideoFile: Boolean(videoFile),
    hasVimeoUrl: Boolean(vimeoUrl),
  });

  try {
    const response = await api.post('/dashboard/daily-video/upload', formData);
    console.log('Upload success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Upload error:', error.response?.data || error.message);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<DashboardNotificationItem> {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
}
