'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
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
          'transition-all duration-300 ease-out',
          'hover:border-accent-primary/50 hover:shadow-md',
          isFeatured && 'ring-accent-primary/30 ring-2'
        )}
      >
        <div className="relative aspect-video overflow-hidden">
          {quiz.cover_image_url ? (
            <img
              src={quiz.cover_image_url}
              alt={quiz.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="from-accent-primary/20 to-accent-secondary/20 flex h-full w-full items-center justify-center bg-gradient-to-br">
              <span className="text-5xl opacity-40">{quiz.quiz_type === 'personality' ? '🎭' : quiz.quiz_type === 'trivia' ? '🧠' : '📊'}</span>
            </div>
          )}
          <div className="from-bg-secondary/60 absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        <div className="p-4 md:p-5 min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                quiz.quiz_type === 'personality'
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : quiz.quiz_type === 'trivia'
                    ? 'bg-accent-secondary/15 text-accent-secondary'
                    : 'bg-bg-tertiary text-text-secondary'
              )}
            >
              {quiz.quiz_type === 'personality' && '🧠 '}
              {quiz.quiz_type === 'trivia' && '📝 '}
              {quiz.quiz_type.charAt(0).toUpperCase() + quiz.quiz_type.slice(1)}
            </span>
            {quiz.difficulty && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  quiz.difficulty === 'easy'
                    ? 'bg-success/15 text-success'
                    : quiz.difficulty === 'medium'
                      ? 'bg-warning/15 text-warning'
                      : 'bg-error/15 text-error'
                )}
              >
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </span>
            )}
          </div>

          <h3 className="text-text-primary group-hover:text-accent-primary mb-2 line-clamp-2 break-words text-base font-semibold transition-colors md:text-lg">
            {quiz.title}
          </h3>

          {quiz.description && (
            <p className="text-text-secondary mb-4 line-clamp-2 text-sm">{quiz.description}</p>
          )}

          <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="whitespace-nowrap">
              {formatCompactNumber(quiz.plays_count)} plays
            </span>
            <span className="whitespace-nowrap">{quiz.estimated_minutes} min</span>
            {quiz.avg_score != null && (
              <span className="whitespace-nowrap">{Math.round(quiz.avg_score)}%</span>
            )}
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(600px circle at var(--x, 50%) var(--y, 50%), rgba(124, 58, 237, 0.08), transparent 40%)',
          }}
        />
      </motion.div>
    </Link>
  );
}

export default QuizCard;
