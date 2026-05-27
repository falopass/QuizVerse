'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { getLocalizedDifficultyLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { QuizImage } from '@/components/shared/quiz-image';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface EditorialQuizCardProps {
  quiz: Quiz;
  locale: Locale;
  index?: number;
  size?: 'hero' | 'feature' | 'default' | 'compact';
}

const SIZE_STYLES = {
  hero: {
    minH: 'min-h-[26rem]',
    title: 'text-2xl md:text-3xl lg:text-4xl',
    desc: 'line-clamp-3 text-[0.95rem] leading-7',
    tags: 4,
  },
  feature: {
    minH: 'min-h-[22rem]',
    title: 'text-xl md:text-2xl lg:text-3xl',
    desc: 'line-clamp-3 text-[0.92rem] leading-7',
    tags: 3,
  },
  default: {
    minH: '',
    title: 'text-lg md:text-xl',
    desc: 'line-clamp-2 text-sm leading-6',
    tags: 3,
  },
  compact: {
    minH: '',
    title: 'text-base md:text-lg',
    desc: 'line-clamp-2 text-xs leading-5',
    tags: 2,
  },
} as const;

export function EditorialQuizCard({
  quiz,
  locale,
  index = 0,
  size = 'default',
}: EditorialQuizCardProps) {
  const href = localizeHref(locale, `/quiz/${quiz.slug}`);
  const likesLabel = locale === 'es' ? 'me gusta' : 'likes';
  const playsLabel = locale === 'es' ? 'partidas' : 'plays';
  const openLabel = locale === 'es' ? 'Abrir quiz' : 'Open quiz';
  const styles = SIZE_STYLES[size];

  return (
    <Link href={href} className="group block min-w-0">
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.45 }}
        whileHover={{ y: -6 }}
        className={cn(
          'border-border-subtle bg-bg-secondary hover:shadow-md relative overflow-hidden rounded-2xl border transition-all duration-200 hover:border-border-hover',
          size === 'hero' && styles.minH,
          size === 'feature' && styles.minH,
          size === 'compact' && 'rounded-xl'
        )}
      >
        <div className="relative flex flex-col p-4 md:p-5">
          <div className="relative overflow-hidden rounded-xl">
            <QuizImage
              src={quiz.cover_image_url}
              alt={quiz.title}
              quizType={quiz.quiz_type}
              className={size === 'hero' || size === 'feature' ? 'aspect-[16/10] w-full' : 'aspect-[16/9] w-full'}
            />
            {quiz.is_featured && (
              <span className="absolute top-3 left-3 bg-accent-tertiary/90 text-text-primary rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
                {locale === 'es' ? 'Selección editorial' : 'Editorial pick'}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col min-w-0">
            <div className="min-w-0 space-y-2">
              <h3
                className={cn(
                  'text-text-primary group-hover:text-accent-primary font-semibold leading-snug transition-colors line-clamp-2',
                  size === 'hero' ? 'font-display' : '',
                  styles.title
                )}
              >
                {quiz.title}
              </h3>
              {quiz.description && size !== 'compact' && (
                <p className={cn('text-text-secondary leading-relaxed', styles.desc)}>
                  {quiz.description}
                </p>
              )}
            </div>

            <div className="mt-auto space-y-4 pt-5">
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-accent-primary/10 text-accent-primary inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
                  {getLocalizedTypeLabel(quiz.quiz_type, locale)}
                </span>
                <span className="bg-bg-tertiary text-text-secondary inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
                  {getLocalizedDifficultyLabel(quiz.difficulty, locale)}
                </span>
                {quiz.tags.slice(0, styles.tags).map((tag) => (
                  <span
                    key={tag}
                    className="bg-bg-tertiary text-text-muted inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase"
                  >
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>

              <div className="text-text-muted border-border-subtle flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px] font-semibold tracking-wider uppercase">
                <span>{quiz.estimated_minutes} min</span>
                <span className="whitespace-nowrap">
                  {formatCompactNumber(quiz.plays_count)} {playsLabel}
                </span>
                <span className="whitespace-nowrap">
                  {formatCompactNumber(quiz.likes_count)} {likesLabel}
                </span>
              </div>

              <div className="text-accent-primary inline-flex items-center gap-2 text-sm font-semibold">
                <span>{openLabel}</span>
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
