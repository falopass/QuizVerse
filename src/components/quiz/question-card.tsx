'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import type { Question } from '@/types/quiz';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  showExplanation?: boolean;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  showExplanation = false,
  disabled = false,
}: QuestionCardProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Progress indicator */}
      <div className="mb-6 text-center">
        <span className="text-text-secondary text-sm font-medium">
          Question {questionNumber} of {totalQuestions}
        </span>
      </div>

      {/* Question */}
      <h2 className="font-display text-text-primary mb-8 text-center text-xl font-semibold md:text-2xl">
        {question.question}
      </h2>

      {/* Question image (if any) */}
      {question.image_url && (
        <div className="mb-6 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.image_url}
            alt="Question illustration"
            className="bg-bg-secondary h-auto max-h-64 w-full object-contain"
          />
        </div>
      )}

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.id}
            onClick={() => !disabled && onSelectOption(option.id)}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl p-4 text-left',
              'border-2 transition-all duration-200',
              'hover:border-accent-primary/50 hover:bg-bg-tertiary/50',
              'focus:ring-accent-primary focus:ring-offset-bg-primary focus:ring-2 focus:ring-offset-2 focus:outline-none',
              disabled && 'cursor-not-allowed opacity-50',
              selectedOptionId === option.id
                ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                : 'border-border-subtle bg-bg-secondary text-text-secondary'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Option indicator */}
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2',
                  'shrink-0 transition-colors',
                  selectedOptionId === option.id
                    ? 'border-accent-primary bg-accent-primary'
                    : 'border-border-subtle'
                )}
              >
                {selectedOptionId === option.id && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>

              {/* Option text */}
              <span className="flex-1 font-medium">{option.text}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Explanation (shown after answering) */}
      {showExplanation && question.explanation && (
        <div className="bg-bg-tertiary border-border-subtle mt-6 rounded-xl border p-4">
          <h3 className="text-text-primary mb-2 text-sm font-semibold">💡 Explanation</h3>
          <p className="text-text-secondary text-sm">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
