import api from '@/lib/api';
import type { CourseStructure } from '@/types/course';

/* ── Course CRUD ──────────────────────────────────────────────── */

export interface CoursePayload {
  title: string;
  slug: string;
  short_description?: string;
  description?: string;
  thumbnail_url?: string;
  objectives?: string[];
  requirements?: string[];
  level?: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes?: number;
  visibility?: 'public' | 'private';
  status?: string;
  is_published?: boolean;
  price?: number;
  category_id?: number | null;
  tag_ids?: number[];
  instructor_ids?: number[];
  owner_id?: number;
  is_featured?: boolean;
  lessons?: { title: string; description: string; file: File }[];
}

export interface CourseData {
  id: number;
  title: string;
  slug: string;
  short_description?: string;
  description?: string;
  thumbnail_url?: string;
  objectives?: string[];
  requirements?: string[];
  level: string;
  duration_minutes?: number;
  visibility: string;
  status: string;
  is_published: boolean;
  price: number;
  category?: { id: number; name: string; description?: string } | null;
  tags: { id: number; name: string }[];
  instructors: { id: number; email: string; full_name: string; role?: string }[];
  owner_id?: number;
  average_rating: number;
  review_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryData {
  id: number;
  name: string;
  description?: string;
}

export interface TagData {
  id: number;
  name: string;
}

export interface ModulePayload {
  course_id: number;
  title: string;
  description?: string;
  position?: number;
}

export interface ModuleData {
  id: number;
  course_id: number;
  title: string;
  description?: string | null;
  position: number;
  lessons: LessonData[];
}

export interface LessonPayload {
  course_id: number;
  module_id: number;
  parent_lesson_id?: number | null;
  title: string;
  content?: string;
  content_type?: string;
  duration_minutes?: number;
  position?: number;
  is_locked?: boolean;
  is_mandatory?: boolean;
  drip_enabled?: boolean;
  available_at?: string | null;
  unlock_after_days?: number | null;
  prerequisite_ids?: number[];
  content_payload?: Record<string, unknown> | null;
}

export interface FileMetadata {
  key: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

export interface LessonData {
  id: number;
  course_id: number;
  module_id: number;
  parent_lesson_id?: number | null;
  title: string;
  content?: string | null;
  content_type: string;
  duration_minutes?: number | null;
  position: number;
  is_locked: boolean;
  is_mandatory: boolean;
  content_payload?: Record<string, unknown> | null;
  drip_enabled: boolean;
  available_at?: string | null;
  unlock_after_days?: number | null;
  prerequisite_ids?: number[];
  children?: LessonData[];
}

export interface EnrollmentData {
  id: number;
  user_id: number;
  course_id: number;
  status: string;
  progress: number;
  enrolled_at: string;
  completed_at?: string;
}

/* ── Quiz Types ───────────────────────────────────────────────── */

export type QuizQuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'
  | 'long_answer'
  | 'file_upload'
  | 'coding_question';

export interface QuizQuestionCreatePayload {
  text: string;
  question_type: QuizQuestionType;
  choices?: string[];
  correct_answer?: string | boolean | string[] | null;
  points: number;
}

export interface QuizQuestionData {
  id: number;
  text: string;
  question_type: QuizQuestionType;
  choices?: string[];
  correct_answer?: string | boolean | string[] | null;
  points: number;
}

export interface QuizCreatePayload {
  course_id: number;
  title: string;
  description?: string;
  total_points?: number;
  passing_score: number;
  pass_percentage: number;
  time_limit_minutes: number;
  randomize_questions: boolean;
  question_count: number;
  max_attempts: number;
  auto_grade_enabled: boolean;
  published: boolean;
  due_date?: string;
  questions: QuizQuestionCreatePayload[];
}

export interface QuizUpdatePayload {
  course_id?: number;
  title?: string;
  description?: string;
  total_points?: number;
  passing_score?: number;
  pass_percentage?: number;
  time_limit_minutes?: number;
  randomize_questions?: boolean;
  question_count?: number;
  max_attempts?: number;
  auto_grade_enabled?: boolean;
  published?: boolean;
  due_date?: string;
}

export interface QuizData {
  id: number;
  course_id: number;
  title: string;
  description?: string;
  total_points: number;
  passing_score: number;
  pass_percentage: number;
  time_limit_minutes: number;
  randomize_questions: boolean;
  question_count: number;
  max_attempts: number;
  auto_grade_enabled: boolean;
  published: boolean;
  due_date?: string;
  questions: QuizQuestionData[];
}

/* ── Courses ─────────────────────────────────────────────────── */

export async function fetchInstructorCourses(): Promise<CourseData[]> {
  const resp = await api.get('/courses/');
  return resp.data;
}

export async function fetchCourse(courseId: number): Promise<CourseData> {
  const resp = await api.get(`/courses/${courseId}`);
  return resp.data;
}

export async function createCourse(payload: CoursePayload): Promise<CourseData> {
  const resp = await api.post('/courses/', payload);
  return resp.data;
}

export async function updateCourse(courseId: number, payload: Partial<CoursePayload>): Promise<CourseData> {
  const resp = await api.put(`/courses/${courseId}`, payload);
  return resp.data;
}

export async function deleteCourse(courseId: number): Promise<void> {
  await api.delete(`/courses/${courseId}`);
}

/* ── Course Structure ────────────────────────────────────────── */

export async function fetchCourseStructure(courseId: number): Promise<CourseStructure> {
  const resp = await api.get(`/courses/course/${courseId}/structure`);
  return resp.data;
}

/* ── Modules ─────────────────────────────────────────────────── */

export async function createModule(payload: ModulePayload): Promise<ModuleData> {
  const resp = await api.post('/courses/modules', payload);
  return resp.data;
}

export async function updateModule(moduleId: number, payload: Partial<ModulePayload>): Promise<ModuleData> {
  const resp = await api.put(`/courses/modules/${moduleId}`, payload);
  return resp.data;
}

export async function deleteModule(moduleId: number): Promise<void> {
  await api.delete(`/courses/modules/${moduleId}`);
}

export async function reorderModules(courseId: number, moduleIds: number[]): Promise<ModuleData[]> {
  const resp = await api.put(`/courses/${courseId}/modules/order`, { module_ids: moduleIds });
  return resp.data;
}

/* ── Lessons ─────────────────────────────────────────────────── */

export async function createLesson(payload: LessonPayload): Promise<LessonData> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenant = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;

  const resp = await api.post('/courses/lessons', payload, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { 'x-tenant-id': tenant } : {}),
    },
  });
  return resp.data;
}

export async function uploadFile(file: File): Promise<FileMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await api.post('/files/upload', formData);
  return resp.data;
}

export async function updateLesson(lessonId: number, payload: Partial<LessonPayload>): Promise<LessonData> {
  const resp = await api.put(`/courses/lessons/${lessonId}`, payload);
  return resp.data;
}

export async function deleteLesson(lessonId: number): Promise<void> {
  await api.delete(`/courses/lessons/${lessonId}`);
}

export async function reorderLessons(moduleId: number, lessonIds: number[]): Promise<LessonData[]> {
  const resp = await api.put(`/courses/modules/${moduleId}/lessons/order`, { lesson_ids: lessonIds });
  return resp.data;
}

/* ── Quizzes ─────────────────────────────────────────────────── */

export async function createQuiz(payload: QuizCreatePayload): Promise<QuizData> {
  const resp = await api.post('/quizzes', payload);
  return resp.data;
}

export async function fetchQuizzes(): Promise<QuizData[]> {
  const resp = await api.get('/quizzes');
  return resp.data;
}

export async function fetchQuiz(quizId: number): Promise<QuizData> {
  const resp = await api.get(`/quizzes/${quizId}`);
  return resp.data;
}

export async function updateQuiz(quizId: number, payload: Partial<QuizUpdatePayload>): Promise<QuizData> {
  const resp = await api.put(`/quizzes/${quizId}`, payload);
  return resp.data;
}

export async function deleteQuiz(quizId: number): Promise<void> {
  await api.delete(`/quizzes/${quizId}`);
}

export async function createQuizQuestion(quizId: number, payload: QuizQuestionCreatePayload): Promise<QuizQuestionData> {
  const resp = await api.post(`/quizzes/${quizId}/questions`, payload);
  return resp.data;
}

export async function fetchQuizQuestions(quizId: number): Promise<QuizQuestionData[]> {
  const resp = await api.get(`/quizzes/${quizId}/questions`);
  return resp.data;
}

/* ── Categories & Tags ───────────────────────────────────────── */

export async function fetchCategories(): Promise<CategoryData[]> {
  const resp = await api.get('/courses/categories');
  return resp.data;
}

export async function fetchTags(): Promise<TagData[]> {
  const resp = await api.get('/courses/tags');
  return resp.data;
}

/* ── Enrollment ──────────────────────────────────────────────── */

export async function enrollInCourse(courseId: number): Promise<EnrollmentData> {
  const resp = await api.post(`/courses/${courseId}/enroll`);
  return resp.data;
}

export async function unenrollFromCourse(courseId: number): Promise<void> {
  await api.delete(`/courses/${courseId}/enroll`);
}

export async function getEnrollment(courseId: number): Promise<EnrollmentData | null> {
  try {
    const resp = await api.get(`/courses/${courseId}/enrollment`);
    return resp.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // Not enrolled
    }
    throw error;
  }
}
