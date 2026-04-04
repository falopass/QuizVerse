'use client';

import { useMemo } from 'react';
import type { Quiz } from '@/types/quiz';
import { QuizCard } from './quiz-card';

export interface QuizGridProps {
  quizzes: Quiz[];
  columns?: 2 | 3 | 4;
  emptyMessage?: string;
}

export function QuizGrid({ quizzes, columns = 3, emptyMessage = 'No quizzes found' }: QuizGridProps) {
  const columnClasses = useMemo(() => {
    switch (columns) {
      case 2:
        return 'grid-cols-1 sm:grid-cols-2';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  }, [columns]);

  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-6xl mb-4">📚</span>
        <p className="text-text-secondary text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${columnClasses}`}>
      {quizzes.map((quiz, index) => (
        <QuizCard key={quiz.id} quiz={quiz} index={index} />
      ))}
    </div>
  );
}

export default QuizGrid;
