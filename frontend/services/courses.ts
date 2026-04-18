import api from '@/lib/api';
import type { Course, CourseDetails, CourseFilter, CoursePayload, CourseStructure, Lesson, StudentCourseScores, StudentCourseDashboard, LiveSessionRecording, LiveSessionRecordingCreate } from '@/types/course';

export type { LiveSessionRecording, LiveSessionRecordingCreate };

export async function fetchCourses(filters?: CourseFilter): Promise<Course[]> {
  const response = await api.get('/courses', { params: filters });
  return response.data;
}

export async function fetchCourse(courseId: string | number): Promise<CourseDetails> {
  const response = await api.get(`/courses/${courseId}`);
  return response.data;
}

export async function createCourse(payload: CoursePayload): Promise<CourseDetails> {
  const response = await api.post('/courses', payload);
  return response.data;
}

export async function updateCourse(courseId: number, payload: Partial<CoursePayload>): Promise<CourseDetails> {
  const response = await api.put(`/courses/${courseId}`, payload);
  return response.data;
}

export async function deleteCourse(courseId: number): Promise<void> {
  await api.delete(`/courses/${courseId}`);
}

export async function fetchCourseStructure(courseId: string | number): Promise<CourseStructure> {
  const response = await api.get(`/courses/course/${courseId}/structure`);
  return response.data;
}

export async function fetchLesson(lessonId: string | number): Promise<Lesson> {
  const response = await api.get(`/courses/lessons/${lessonId}`);
  return response.data;
}

export async function markLessonComplete(lessonId: string | number): Promise<void> {
  await api.post(`/courses/lessons/${lessonId}/complete`);
}

export async function fetchStudentCourseScores(courseId: string | number): Promise<StudentCourseScores> {
  const response = await api.get(`/student/course/${courseId}/scores`);
  return response.data;
}

export async function fetchStudentCourseDashboard(courseId: string | number): Promise<StudentCourseDashboard> {
  const response = await api.get(`/student/course/${courseId}`);
  return response.data;
}

export async function uploadLiveSessionRecording(
  courseId: number,
  liveSessionId: number,
  title: string,
  file: File,
  durationMinutes?: number,
  notes?: string
): Promise<LiveSessionRecording> {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);
  if (durationMinutes !== undefined) {
    formData.append('duration_minutes', durationMinutes.toString());
  }
  if (notes) {
    formData.append('notes', notes);
  }

  const response = await api.post(
    `/courses/${courseId}/live-sessions/${liveSessionId}/recordings`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

export async function fetchLiveSessionRecordings(
  courseId: number,
  liveSessionId: number,
  limit: number = 25,
  offset: number = 0
): Promise<LiveSessionRecording[]> {
  const response = await api.get(
    `/courses/${courseId}/live-sessions/${liveSessionId}/recordings`,
    {
      params: { limit, offset },
    }
  );
  return response.data;
}
