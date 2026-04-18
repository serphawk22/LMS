export interface Course {
  id: number;
  title: string;
  slug?: string;
  short_description?: string;
  description?: string;
  objectives?: string[];
  requirements?: string[];
  level?: string;
  duration_minutes?: number;
  visibility?: string;
  status?: string;
  is_published?: boolean;
  category?: string | { id?: number; name?: string; description?: string | null };
  instructor_name?: string;
  instructors?: { id?: number; full_name?: string }[];
  owner_id?: number;
  is_featured?: boolean;
  average_rating?: number;
  thumbnail_url?: string;
  price?: number;
  created_at?: string;
}

export interface CoursePayload {
  title: string;
  slug: string;
  short_description?: string;
  description?: string;
  thumbnail_url?: string;
  objectives?: string[];
  requirements?: string[];
  level?: string;
  duration_minutes?: number;
  visibility?: string;
  status?: string;
  is_published?: boolean;
  price?: number;
  category_id?: number | null;
  tag_ids?: number[] | null;
  instructor_ids?: number[] | null;
  owner_id?: number | null;
  is_featured?: boolean;
}

export interface CourseFilter {
  search?: string;
  category_id?: number;
  instructor_id?: number;
  level?: string;
  min_rating?: number;
}

export interface CourseDetails extends Course {
  syllabus?: string;
  lessons_count?: number;
  students_enrolled?: number;
  quizzes_count?: number;
  lessons?: CourseLesson[];
}

export interface CourseAnalytics {
  course_id: number;
  total_students: number;
  active_students: number;
  completed_students: number;
  average_progress: number;
  total_lessons: number;
  completed_lessons: number;
  lesson_completion_rate: number;
  average_rating: number;
  review_count: number;
  rating_breakdown: Record<string, number>;
  quiz_performance: {
    quiz_id: number;
    title: string;
    total_attempts: number;
    average_score: number;
    pass_rate: number;
  }[];
}

export interface LessonSubtitle {
  label: string;
  language: string;
  url: string;
}

export interface LessonResource {
  id: string;
  title: string;
  url: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface LessonContentPayload {
  video_url?: string;
  file_url?: string;
  mime_type?: string;
  file_size_bytes?: number;
  subtitles?: LessonSubtitle[];
  resources?: LessonResource[];
  [key: string]: unknown;
}

export interface Lesson {
  id: number;
  course_id: number;
  module_id: number;
  parent_lesson_id?: number | null;
  title: string;
  content?: string | null;
  content_type: string;
  duration_minutes?: number | null;
  position: number;
  content_payload?: LessonContentPayload | null;
  video_url?: string | null;
  is_locked: boolean;
  is_mandatory: boolean;
  drip_enabled: boolean;
  available_at?: string | null;
  unlock_after_days?: number | null;
  prerequisite_ids?: number[];
  children?: Lesson[];
}

export interface CourseLesson {
  id: number;
  title: string;
  video_url?: string | null;
  description?: string | null;
  content_payload?: LessonContentPayload | null;
}

export interface Module {
  id: number;
  course_id: number;
  title: string;
  description?: string | null;
  position: number;
  lessons: Lesson[];
}

export interface CourseStructure extends Course {
  modules: Module[];
}

export interface StudentQuizScore {
  title: string;
  score: number | null;
  total: number;
}

export interface StudentAssignmentScore {
  title: string;
  score: number | null;
  total: number;
  reviewed: boolean;
  feedback?: string;
  status: string;
}

export interface StudentCourseScores {
  quizzes: StudentQuizScore[];
  assignments: StudentAssignmentScore[];
}

export interface StudentCourseDashboard {
  lessons: Lesson[];
  assignments: any[]; // Will use proper Assignment type
  quizzes: any[]; // Will use proper Quiz type
  announcements: any[]; // Will use proper Announcement type
}

export interface LiveSessionRecording {
  id: number;
  title: string;
  file_url: string;
  file_key: string;
  duration_minutes: number | null;
  notes: string | null;
  uploaded_at: string;
  uploaded_by_id: number | null;
}

export interface LiveSessionRecordingCreate {
  title: string;
  duration_minutes?: number | null;
  notes?: string | null;
}
