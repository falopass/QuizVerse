'use client';

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
    <article className="surface-panel mx-auto w-full max-w-4xl overflow-hidden p-5 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.28fr_0.72fr]">
        <aside className="bg-bg-tertiary space-y-5 rounded-2xl p-5">
          <div>
            <span className="eyebrow">Question</span>
            <p className="font-display text-text-primary mt-2 text-4xl font-bold">{questionNumber}</p>
            <p className="text-text-secondary mt-1 text-sm">of {totalQuestions}</p>
          </div>

          <div className="space-y-2">
            <div className="bg-bg-secondary h-1 overflow-hidden rounded-full">
              <div
                className="bg-accent-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
              />
            </div>
            <span className="eyebrow">Editorial play mode</span>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="space-y-3">
            <span className="eyebrow">Current prompt</span>
            <h2 className="text-text-primary text-xl leading-snug font-semibold md:text-3xl">
              {question.question}
            </h2>
          </div>

          {question.image_url && (
            <div className="overflow-hidden rounded-[1.75rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={question.image_url}
                alt="Question illustration"
                className="bg-bg-secondary h-auto max-h-80 w-full object-contain"
              />
            </div>
          )}

          <div className="grid gap-2.5">
            {question.options.map((option, index) => (
              <button
                key={option.id}
                onClick={() => !disabled && onSelectOption(option.id)}
                disabled={disabled}
                className={cn(
                  'group rounded-xl border px-4 py-4 text-left transition-all duration-200',
                  'focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  disabled && 'cursor-not-allowed opacity-50',
                  selectedOptionId === option.id
                    ? 'border-accent-primary bg-bg-primary text-text-primary'
                    : 'border-border-subtle bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-secondary'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                      selectedOptionId === option.id
                        ? 'border-accent-primary bg-accent-primary text-white'
                        : 'border-border-subtle bg-bg-secondary text-text-muted group-hover:text-text-primary'
                    )}
                  >
                    {String.fromCharCode(65 + index)}
                  </div>
                  <p className="text-base font-medium leading-relaxed">{option.text}</p>
                </div>
              </button>
            ))}
          </div>

          {showExplanation && question.explanation && (
            <div className="bg-bg-tertiary rounded-2xl p-5">
              <span className="eyebrow">Explanation</span>
              <p className="text-text-secondary mt-3 text-sm leading-relaxed">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
