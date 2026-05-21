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
    <article className="surface-panel mx-auto w-full max-w-4xl overflow-hidden p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.28fr_0.72fr]">
        <aside className="border-border-subtle bg-bg-primary space-y-6 rounded-[1.75rem] border p-5">
          <div>
            <p className="text-text-muted text-[11px] font-semibold tracking-[0.24em] uppercase">
              Question
            </p>
            <p className="text-text-primary mt-2 text-4xl font-semibold">{questionNumber}</p>
            <p className="text-text-secondary mt-1 text-sm">of {totalQuestions}</p>
          </div>

          <div className="space-y-3">
            <div className="bg-bg-secondary h-2 overflow-hidden rounded-full">
              <div
                className="bg-accent-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-xs tracking-[0.18em] uppercase">
              Editorial play mode
            </p>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="space-y-4">
            <p className="eyebrow">Current prompt</p>
            <h2 className="text-text-primary text-2xl leading-tight font-semibold md:text-4xl">
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

          <div className="grid gap-3">
            {question.options.map((option, index) => (
              <button
                key={option.id}
                onClick={() => !disabled && onSelectOption(option.id)}
                disabled={disabled}
                className={cn(
                  'group rounded-[1.5rem] border px-5 py-5 text-left transition-all duration-200',
                  'focus:ring-accent-primary focus:ring-offset-bg-primary focus:ring-2 focus:ring-offset-2 focus:outline-none',
                  disabled && 'cursor-not-allowed opacity-50',
                  selectedOptionId === option.id
                    ? 'border-accent-primary bg-accent-primary/10 text-text-primary shadow-card'
                    : 'border-border-subtle bg-bg-secondary text-text-secondary hover:border-accent-primary/35 hover:bg-bg-primary hover:-translate-y-0.5'
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
                  <p className="text-base leading-7 font-medium">{option.text}</p>
                </div>
              </button>
            ))}
          </div>

          {showExplanation && question.explanation && (
            <div className="border-border-subtle bg-bg-primary rounded-[1.75rem] border p-5">
              <h3 className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
                Explanation
              </h3>
              <p className="text-text-secondary mt-3 text-sm leading-6">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
