'use client';

import type { Quiz } from '@/types/quiz';
import { QuizCard } from '@/components/quiz/quiz-card';

export interface ProfileQuizListProps {
  quizzes: Quiz[];
  title: string;
  emptyMessage?: string;
}

export function ProfileQuizList({
  quizzes,
  title,
  emptyMessage = 'No quizzes yet',
}: ProfileQuizListProps) {
  return (
    <div>
      <h2 className="text-text-primary mb-4 text-xl font-bold">{title}</h2>
      {quizzes.length === 0 ? (
        <div className="text-text-muted py-12 text-center">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz, index) => (
            <QuizCard key={quiz.id} quiz={quiz} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProfileQuizList;
