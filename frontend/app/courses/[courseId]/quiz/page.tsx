'use client';

import { useParams } from 'next/navigation';
import QuizPlayer from '@/components/QuizPlayer';
import { useAuth } from '@/hooks/useAuth';
import ChatBot from '@/components/ChatBot';

interface CourseQuizPageProps {
  params: {
    courseId: string;
  };
}

export default function CourseQuizPage({ params }: CourseQuizPageProps) {
  const courseId = Number(params.courseId);
  const { role } = useAuth();
  
  if (!courseId || isNaN(courseId)) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <div className="w-full">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">
            Invalid course ID.
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <QuizPlayer courseId={courseId} />
      {role === 'student' && <ChatBot />}
    </>
  );
}
