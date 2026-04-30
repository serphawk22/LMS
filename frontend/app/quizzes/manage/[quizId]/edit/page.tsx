'use client';

import QuizEditor from '../../../../../components/QuizEditor';

interface EditQuizPageProps {
  params: {
    quizId: string;
  };
}

export default function EditQuizPage({ params }: EditQuizPageProps) {
  return <QuizEditor quizId={Number(params.quizId)} />;
}
