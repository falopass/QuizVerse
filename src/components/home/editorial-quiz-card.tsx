'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { getLocalizedDifficultyLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface EditorialQuizCardProps {
  quiz: Quiz;
  locale: Locale;
  index?: number;
  size?: 'hero' | 'feature' | 'default' | 'compact';
}

export function EditorialQuizCard({
  quiz,
  locale,
  index = 0,
  size = 'default',
}: EditorialQuizCardProps) {
  const href = localizeHref(locale, `/quiz/${quiz.slug}`);
  const readsLabel = locale === 'es' ? 'me gusta' : 'likes';
  const playsLabel = locale === 'es' ? 'partidas' : 'plays';
  const openLabel = locale === 'es' ? 'Abrir quiz' : 'Open quiz';
  const isLarge = size === 'hero' || size === 'feature';

  return (
    <Link href={href} className="group block">
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.45 }}
        whileHover={{ y: -6 }}
        className={cn(
          'border-border-subtle/90 shadow-card hover:shadow-elevated relative overflow-hidden rounded-[2rem] border bg-[rgba(255,250,244,0.84)] transition-all duration-300 ease-out hover:border-[rgba(187,75,53,0.24)]',
          size === 'hero' && 'min-h-[28rem]',
          size === 'feature' && 'min-h-[24rem]',
          size === 'compact' && 'rounded-[1.75rem]'
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_38%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(187,75,53,0.42),transparent)]" />

        <div className="relative flex h-full flex-col p-5 md:p-6">
          <QuizCoverArt
            quiz={quiz}
            locale={locale}
            ratioClassName={isLarge ? 'aspect-[16/10]' : 'aspect-[16/9]'}
            priorityLabel={
              quiz.is_featured
                ? locale === 'es'
                  ? 'Selección editorial'
                  : 'Editorial pick'
                : undefined
            }
          />

          <div className="mt-5 flex flex-1 flex-col">
            <div className="space-y-3">
              <h3
                className={cn(
                  'text-text-primary group-hover:text-accent-hover font-semibold tracking-tight transition-colors',
                  size === 'hero'
                    ? 'text-3xl md:text-[3rem]'
                    : size === 'feature'
                      ? 'text-[2.25rem]'
                      : size === 'compact'
                        ? 'text-xl'
                        : 'text-[1.8rem]'
                )}
              >
                {quiz.title}
              </h3>
              {quiz.description ? (
                <p
                  className={cn(
                    'text-text-secondary',
                    size === 'compact'
                      ? 'line-clamp-3 text-sm leading-6'
                      : isLarge
                        ? 'line-clamp-3 text-[1rem] leading-7'
                        : 'line-clamp-3 text-[0.98rem] leading-7'
                  )}
                >
                  {quiz.description}
                </p>
              ) : null}
            </div>

            <div className="mt-auto space-y-4 pt-6">
              <div className="flex flex-wrap gap-2">
                <span className="text-text-muted rounded-full border border-black/8 bg-white/72 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] uppercase">
                  {getLocalizedTypeLabel(quiz.quiz_type, locale)}
                </span>
                <span className="text-text-secondary rounded-full border border-black/8 bg-white/55 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
                  {getLocalizedDifficultyLabel(quiz.difficulty, locale)}
                </span>
                {quiz.tags.slice(0, size === 'compact' ? 2 : 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-text-muted rounded-full border border-black/8 bg-white/55 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase"
                  >
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>

              <div className="text-text-muted flex items-center justify-between gap-4 border-t border-black/8 pt-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
                <span>{quiz.estimated_minutes} min</span>
                <span>
                  {formatCompactNumber(quiz.plays_count)} {playsLabel}
                </span>
                <span>
                  {formatCompactNumber(quiz.likes_count)} {readsLabel}
                </span>
              </div>

              <div className="text-accent-primary inline-flex items-center gap-2 text-sm font-semibold">
                <span>{openLabel}</span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
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
