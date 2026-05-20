'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { ProgressBar } from '@/components/ui/progress-bar';

interface QuizProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining?: number;
  timeLimit?: number;
}

export function QuizProgress({
  currentQuestion,
  totalQuestions,
  timeRemaining,
  timeLimit,
}: QuizProgressProps) {
  const progressPercentage = (currentQuestion / totalQuestions) * 100;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="mb-2">
        <ProgressBar
          value={currentQuestion}
          max={totalQuestions}
          size="md"
          variant="gradient"
          animated={false}
        />
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary font-medium">
          Question {currentQuestion} / {totalQuestions}
        </span>
        {timeRemaining !== undefined && timeLimit !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1.5 font-mono',
              timeRemaining <= 10 ? 'text-warning' : 'text-text-muted'
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
