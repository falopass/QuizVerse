'use client';

import Link from 'next/link';
import type { Quiz } from '@/types/quiz';
import { QuizCard } from '@/components/quiz/quiz-card';

export interface ProfileQuizListProps {
  quizzes: Quiz[];
  title: string;
  emptyMessage?: string;
}

export function ProfileQuizList({ quizzes, title, emptyMessage = 'No quizzes yet' }: ProfileQuizListProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-4">{title}</h2>
      {quizzes.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz, index) => (
            <QuizCard key={quiz.id} quiz={quiz} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProfileQuizList;
