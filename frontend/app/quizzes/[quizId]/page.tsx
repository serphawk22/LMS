'use client';

import QuizPlayer from '../../../components/QuizPlayer';

interface QuizPageProps {
  params: {
    quizId: string;
  };
}

export default function QuizPage({ params }: QuizPageProps) {
  return <QuizPlayer quizId={Number(params.quizId)} />;
}
