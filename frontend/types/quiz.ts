export type QuizQuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'
  | 'long_answer'
  | 'file_upload'
  | 'coding_question';

export interface QuizQuestion {
  id: number;
  text: string;
  question_type: QuizQuestionType;
  choices?: string[];
  correct_answer?: string | boolean | string[] | null;
  points: number;
}

export interface QuizQuestionEdit extends QuizQuestionCreate {
  id?: number;
}

export interface QuizQuestionCreate {
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
  questions: QuizQuestionCreate[];
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
  start_time?: string;
  due_date?: string;
}

export interface Quiz {
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
  start_time?: string;
  due_date?: string;
  questions: QuizQuestion[];
}

export interface QuizAttemptStart {
  attempt_id: number;
  quiz_id: number;
  title: string;
  time_limit_minutes: number;
  expires_at?: string;
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  question_id: number;
  answer: string | boolean | string[] | { filename: string; content: string; mimeType: string } | null;
}

export interface QuizAttemptAnswer {
  question_id: number;
  question_text: string;
  question_type: QuizQuestionType;
  choices?: string[];
  student_answer: QuizAnswer['answer'];
  correct_answer?: string | boolean | string[] | null;
  is_correct?: boolean | null;
  points_awarded: number;
  points_possible: number;
}

export interface QuizAttemptRead {
  id: number;
  quiz_id: number;
  score: number;
  passed: boolean;
  status: string;
  attempt_number: number;
  started_at: string;
  completed_at?: string;
  submitted_at?: string;
  auto_graded: boolean;
  answers?: QuizAttemptAnswer[];
  quiz_title?: string;
  course_title?: string;
  student_name?: string;
  total_points?: number;
  max_attempts?: number;
}
