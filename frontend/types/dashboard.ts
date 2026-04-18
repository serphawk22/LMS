export interface AdminDashboardOverview {
  total_users: number;
  total_courses: number;
  total_organizations: number;
  revenue: number;
  active_users: number;
}

export interface AdminStudentActivitySummary {
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  courses_enrolled: number;
  assignments_submitted: number;
  quizzes_attempted: number;
  completion_progress: number;
  last_login?: string | null;
}

export interface AdminStudentActivityDetails {
  overall_progress: number;
  courses: Array<{
    course_id: number;
    title: string;
    progress: number;
    status: string;
    enrolled_at?: string | null;
    completed_at?: string | null;
  }>;
  quiz_attempts: Array<{
    attempt_id: number;
    quiz_id: number;
    quiz_title?: string | null;
    course_title?: string | null;
    score: number;
    passed: boolean;
    completed_at?: string | null;
  }>;
  assignment_submissions: Array<{
    submission_id: number;
    assignment_id: number;
    assignment_title?: string | null;
    course_title?: string | null;
    grade?: number | null;
    status: string;
    submitted_at?: string | null;
  }>;
}

export interface AdminInstructorActivitySummary {
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  courses_created: number;
  lessons_uploaded: number;
  quizzes_created: number;
  assignments_created: number;
  students_enrolled: number;
}

export interface AdminInstructorActivityDetails {
  courses: Array<{
    course_id: number;
    title: string;
    status: string;
    is_published: boolean;
    created_at?: string | null;
  }>;
  lessons: Array<{
    lesson_id: number;
    title: string;
    course_id: number;
    course_title?: string | null;
    created_at?: string | null;
  }>;
  quizzes: Array<{
    quiz_id: number;
    title: string;
    course_id: number;
    course_title?: string | null;
    question_count: number;
    created_at?: string | null;
  }>;
  assignments: Array<{
    assignment_id: number;
    title: string;
    course_id: number;
    course_title?: string | null;
    max_score: number;
    created_at?: string | null;
  }>;
  total_students_enrolled: number;
}

export interface AdminComment {
  id: number;
  admin_name: string;
  content: string;
  created_at: string;
}

export interface WeeklyStats {
  courses_enrolled: number;
  courses_completed: number;
  quizzes_attempted: number;
  assignments_submitted: number;
  lessons_completed: number;
  total_study_time_minutes: number;
  average_score: number | null;
  streak_days: number;
}

export interface AdminStudentSubmissionRead {
  student_id: number;
  student_name: string;
  course_title: string;
  assignment_or_quiz: string;
  submission_date: string;
  admin_comment?: string | null;
  comment_id?: number | null;
  related_id: number;
  comment_type: string;
}

export interface AdminInstructorActivityRead {
  instructor_id: number;
  instructor_name: string;
  course_title: string;
  lessons_uploaded: number;
  quizzes_created: number;
  admin_feedback?: string | null;
  comment_id?: number | null;
  related_id: number;
  comment_type: string;
}

export interface DashboardCourseItem {
  course_id: number;
  title: string;
  slug: string;
  thumbnail_url?: string;
  progress: number;
  status: string;
  enrolled_at?: string;
  completed_at?: string;
  is_featured: boolean;
  total_items: number;
  completed_items: number;
  completed_lessons: number;
  completed_quizzes: number;
  completed_assignments: number;
}

export interface DashboardNotificationItem {
  id: number;
  title: string;
  message?: string | null;
  status: string;
  channel: string;
  created_at: string;
}

export interface DailyLearningVideo {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  description: string;
  video_type: 'upload' | 'vimeo';
  video_url: string;
  uploaded_at: string;
}

export interface DashboardOverview {
  enrolled_courses: DashboardCourseItem[];
  continue_learning: DashboardCourseItem[];
  completed_courses: DashboardCourseItem[];
  certificates: Array<{ id: number; course_id: number; issued_at: string }>;
  notifications: DashboardNotificationItem[];
  recommended_courses: DashboardCourseItem[];
  recent_activity: Array<{ id: number; activity_type: string; course_id?: number; course_title?: string; description?: string; created_at: string }>;
  learning_path_progress: Array<{ learning_path_id: number; title: string; slug: string; description?: string; completed_courses: number; total_courses: number; enrolled_courses: number; progress: number }>;
}
