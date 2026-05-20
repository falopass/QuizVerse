'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
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
    <Link href={href} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -4, scale: 1.02 }}
        className={cn(
          'border-border-subtle bg-bg-secondary relative overflow-hidden rounded-2xl border',
          'transition-all duration-300 ease-out',
          'hover:border-accent-primary/50 hover:shadow-glow',
          isFeatured && 'ring-accent-primary/30 ring-2'
        )}
      >
        {/* Cover Image */}
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
              <span className="text-6xl">🧠</span>
            </div>
          )}
          {/* Overlay gradient on hover */}
          <div className="from-bg-secondary absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        {/* Content */}
        <div className="p-4 md:p-5">
          {/* Type badge */}
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                quiz.quiz_type === 'personality'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : quiz.quiz_type === 'trivia'
                    ? 'bg-accent-secondary/20 text-accent-secondary'
                    : 'bg-bg-tertiary text-text-secondary'
              )}
            >
              {quiz.quiz_type === 'personality' && '🧠 '}
              {quiz.quiz_type === 'trivia' && '📝 '}
              {quiz.quiz_type === 'poll' && '📊 '}
              {quiz.quiz_type.charAt(0).toUpperCase() + quiz.quiz_type.slice(1)}
            </span>
            {quiz.difficulty && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  quiz.difficulty === 'easy'
                    ? 'bg-success/20 text-success'
                    : quiz.difficulty === 'medium'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-error/20 text-error'
                )}
              >
                {quiz.difficulty === 'easy' && '🟢 '}
                {quiz.difficulty === 'medium' && '🟡 '}
                {quiz.difficulty === 'hard' && '🔴 '}
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-text-primary group-hover:text-accent-primary mb-2 line-clamp-2 text-lg font-semibold transition-colors md:text-xl">
            {quiz.title}
          </h3>

          {/* Description */}
          {quiz.description && (
            <p className="text-text-secondary mb-4 line-clamp-2 text-sm">{quiz.description}</p>
          )}

          {/* Stats */}
          <div className="text-text-muted flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {quiz.plays_count >= 1000
                ? `${(quiz.plays_count / 1000).toFixed(1)}K`
                : quiz.plays_count}{' '}
              plays
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {quiz.estimated_minutes} min
            </span>
            {quiz.avg_score && (
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                {quiz.avg_score.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Spotlight effect (mouse follow) - CSS only implementation */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(600px circle at var(--x, 50%) var(--y, 50%), rgba(124, 58, 237, 0.1), transparent 40%)',
          }}
        />
      </motion.div>
    </Link>
  );
}

export default QuizCard;
