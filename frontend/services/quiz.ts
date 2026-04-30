import api from '../lib/api';
import type {
  Quiz,
  QuizAttemptRead,
  QuizAttemptStart,
  QuizAnswer,
  QuizCreatePayload,
  QuizQuestion,
  QuizQuestionCreate,
  QuizUpdatePayload,
} from '../types/quiz';

export async function fetchQuizzes(): Promise<Quiz[]> {
  const response = await api.get('/quizzes');
  return response.data;
}

export async function fetchCourseQuizzes(courseId: number): Promise<Quiz[]> {
  const response = await api.get(`/courses/${courseId}/quizzes`);
  return response.data;
}

export async function fetchQuizByCourseId(courseId: number): Promise<Quiz> {
  const response = await api.get(`/quizzes/courses/${courseId}/quiz`);
  return response.data;
}

export async function fetchQuizById(quizId: number): Promise<Quiz> {
  const response = await api.get(`/quizzes/${quizId}`);
  return response.data;
}

export async function fetchQuizByCourseName(courseName: string): Promise<Quiz> {
  const response = await api.get(`/quizzes/course/${encodeURIComponent(courseName)}`);
  return response.data;
}

export async function startQuizById(quizId: number): Promise<QuizAttemptStart> {
  const response = await api.post(`/quizzes/${quizId}/start`);
  return response.data;
}

export async function startQuizByCourseId(courseId: number): Promise<QuizAttemptStart> {
  const response = await api.post(`/quizzes/courses/${courseId}/quiz/start`);
  return response.data;
}

export async function startQuizByCourseName(courseName: string): Promise<QuizAttemptStart> {
  const response = await api.post(`/quizzes/course/${encodeURIComponent(courseName)}/start`);
  return response.data;
}

export async function createQuiz(payload: QuizCreatePayload): Promise<Quiz> {
  const response = await api.post('/quizzes', payload);
  return response.data;
}

export async function updateQuiz(quizId: number, payload: QuizUpdatePayload): Promise<Quiz> {
  const response = await api.put(`/quizzes/${quizId}`, payload);
  return response.data;
}

export async function fetchQuizAttempts(limit = 10, offset = 0): Promise<QuizAttemptRead[]> {
  const response = await api.get('/quizzes/attempts', { params: { limit, offset } });
  return response.data;
}

export async function fetchQuizAttempt(attemptId: number): Promise<QuizAttemptRead> {
  const response = await api.get(`/quizzes/attempts/${attemptId}`);
  return response.data;
}

export async function fetchInstructorQuizResults(limit = 25, offset = 0): Promise<QuizAttemptRead[]> {
  const response = await api.get('/quizzes/results', { params: { limit, offset } });
  return response.data;
}

export async function deleteQuiz(quizId: number): Promise<void> {
  await api.delete(`/quizzes/${quizId}`);
}

export async function fetchQuizQuestions(quizId: number): Promise<QuizQuestion[]> {
  const response = await api.get(`/quizzes/${quizId}/questions`);
  return response.data;
}

export async function createQuizQuestion(quizId: number, payload: QuizQuestionCreate): Promise<QuizQuestion> {
  const response = await api.post(`/quizzes/${quizId}/questions`, payload);
  return response.data;
}

export async function updateQuizQuestion(questionId: number, payload: QuizQuestionCreate): Promise<QuizQuestion> {
  const response = await api.put(`/quizzes/questions/${questionId}`, payload);
  return response.data;
}

export async function deleteQuizQuestion(questionId: number): Promise<void> {
  await api.delete(`/quizzes/questions/${questionId}`);
}

export async function submitQuiz(quizId: number, attemptId: number, answers: QuizAnswer[]): Promise<QuizAttemptRead> {
  const response = await api.post(`/quizzes/${quizId}/submit`, {
    attempt_id: attemptId,
    answers,
  });
  return response.data;
}
