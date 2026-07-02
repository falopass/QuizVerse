'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { QuizImage } from '@/components/shared/quiz-image';
import type { Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

export interface QuizCardProps {
  quiz: Quiz;
  variant?: 'default' | 'compact' | 'featured';
  index?: number;
  locale?: Locale;
}

export function QuizCard({ quiz, variant = 'default', index = 0, locale }: QuizCardProps) {
  const isFeatured = variant === 'featured';
  const href = locale ? localizeHref(locale, `/quiz/${quiz.slug}`) : `/quiz/${quiz.slug}`;

  return (
    <Link href={href} className="group block min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -4, scale: 1.02 }}
        className={cn(
          'border-border-subtle bg-bg-secondary relative overflow-hidden rounded-2xl border',
          'transition-all duration-200',
          'hover:border-border-hover hover:shadow-md',
          isFeatured && 'ring-accent-primary/20 ring-2'
        )}
      >
        <div className="relative aspect-video overflow-hidden rounded-t-2xl">
          <QuizImage
            src={quiz.cover_image_url}
            alt={quiz.title}
            quizType={quiz.quiz_type}
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        <div className="min-w-0 p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase',
                quiz.quiz_type === 'personality'
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : quiz.quiz_type === 'trivia'
                    ? 'bg-accent-secondary/10 text-accent-secondary'
                    : 'bg-bg-tertiary text-text-secondary'
              )}
            >
              {quiz.quiz_type === 'personality' && '🎭 '}
              {quiz.quiz_type === 'trivia' && '🧠 '}
              {quiz.quiz_type.charAt(0).toUpperCase() + quiz.quiz_type.slice(1)}
            </span>
            {quiz.difficulty && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase',
                  quiz.difficulty === 'easy'
                    ? 'bg-success/10 text-success'
                    : quiz.difficulty === 'medium'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-error/10 text-error'
                )}
              >
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </span>
            )}
          </div>

          <h3 className="text-text-primary group-hover:text-accent-primary mb-2 line-clamp-2 text-base leading-snug font-semibold transition-colors md:text-lg">
            {quiz.title}
          </h3>

          {quiz.description && (
            <p className="text-text-secondary mb-4 line-clamp-2 text-sm leading-relaxed">
              {quiz.description}
            </p>
          )}

          <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="whitespace-nowrap">{formatCompactNumber(quiz.plays_count)} plays</span>
            <span className="whitespace-nowrap">{quiz.estimated_minutes} min</span>
            {quiz.avg_score != null && (
              <span className="whitespace-nowrap">{Math.round(quiz.avg_score)}%</span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default QuizCard;
