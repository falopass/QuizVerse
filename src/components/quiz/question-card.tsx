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
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress indicator */}
      <div className="text-center mb-6">
        <span className="text-sm text-text-secondary font-medium">
          Question {questionNumber} of {totalQuestions}
        </span>
      </div>

      {/* Question */}
      <h2 className="text-xl md:text-2xl font-display font-semibold text-text-primary text-center mb-8">
        {question.question}
      </h2>

      {/* Question image (if any) */}
      {question.image_url && (
        <div className="mb-6 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.image_url}
            alt="Question illustration"
            className="w-full h-auto max-h-64 object-contain bg-bg-secondary"
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
              'w-full p-4 rounded-xl text-left',
              'border-2 transition-all duration-200',
              'hover:border-accent-primary/50 hover:bg-bg-tertiary/50',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary',
              disabled && 'opacity-50 cursor-not-allowed',
              selectedOptionId === option.id
                ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                : 'border-border-subtle bg-bg-secondary text-text-secondary'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Option indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  'shrink-0 transition-colors',
                  selectedOptionId === option.id
                    ? 'border-accent-primary bg-accent-primary'
                    : 'border-border-subtle'
                )}
              >
                {selectedOptionId === option.id && (
                  <div className="w-2 h-2 rounded-full bg-white" />
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
        <div className="mt-6 p-4 rounded-xl bg-bg-tertiary border border-border-subtle">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            💡 Explanation
          </h3>
          <p className="text-sm text-text-secondary">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
