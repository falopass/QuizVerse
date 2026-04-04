'use client';

import { cn } from '@/lib/utils/cn';
import type { Question } from '@/types/quiz';

interface QuestionCardV2Props {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  showExplanation?: boolean;
  disabled?: boolean;
}

export function QuestionCardV2({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  showExplanation = false,
  disabled = false,
}: QuestionCardV2Props) {
  return (
    <article className="surface-panel mx-auto w-full max-w-4xl overflow-hidden p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.28fr_0.72fr]">
        <aside className="space-y-6 rounded-[1.75rem] border border-border-subtle bg-bg-primary p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">
              Question
            </p>
            <p className="mt-2 text-4xl font-semibold text-text-primary">{questionNumber}</p>
            <p className="mt-1 text-sm text-text-secondary">of {totalQuestions}</p>
          </div>

          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-accent-primary transition-all duration-300"
                style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
              />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Editorial play mode
            </p>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="space-y-4">
            <p className="eyebrow">Current prompt</p>
            <h2 className="text-2xl font-semibold leading-tight text-text-primary md:text-4xl">
              {question.question}
            </h2>
          </div>

          {question.image_url && (
            <div className="overflow-hidden rounded-[1.75rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={question.image_url}
                alt="Question illustration"
                className="h-auto max-h-80 w-full object-contain bg-bg-secondary"
              />
            </div>
          )}

          <div className="grid gap-3">
            {question.options.map((option, index) => (
              <button
                key={option.id}
                onClick={() => !disabled && onSelectOption(option.id)}
                disabled={disabled}
                className={cn(
                  'group rounded-[1.5rem] border px-5 py-5 text-left transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary',
                  disabled && 'cursor-not-allowed opacity-50',
                  selectedOptionId === option.id
                    ? 'border-accent-primary bg-accent-primary/10 text-text-primary shadow-card'
                    : 'border-border-subtle bg-bg-secondary text-text-secondary hover:-translate-y-0.5 hover:border-accent-primary/35 hover:bg-bg-primary'
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                      selectedOptionId === option.id
                        ? 'border-accent-primary bg-accent-primary text-white'
                        : 'border-border-subtle bg-bg-primary text-text-muted group-hover:text-text-primary'
                    )}
                  >
                    {String.fromCharCode(65 + index)}
                  </div>
                  <p className="text-base font-medium leading-7">{option.text}</p>
                </div>
              </button>
            ))}
          </div>

          {showExplanation && question.explanation && (
            <div className="rounded-[1.75rem] border border-border-subtle bg-bg-primary p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                Explanation
              </h3>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
