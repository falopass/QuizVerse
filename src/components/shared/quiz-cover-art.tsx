import { cn } from '@/lib/utils/cn';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface QuizCoverArtProps {
  quiz: Pick<Quiz, 'slug' | 'title' | 'quiz_type' | 'category' | 'cover_image_url'>;
  locale: Locale;
  className?: string;
  ratioClassName?: string;
  compact?: boolean;
  priorityLabel?: string;
  /**
   * Set where the title is already read out next to the poster (card, detail
   * page, hero link). Without it the same title reaches assistive tech twice:
   * once as the image label and once as the heading.
   */
  decorative?: boolean;
}

/**
 * Poster cover for a quiz. The type is the artwork, so the size is bucketed by
 * title length instead of by viewport: a 64-character Spanish title and a
 * 12-character one cannot share a type size without one of them being clipped.
 */
function titleBucket(title: string, compact: boolean) {
  if (compact && title.length <= 24) return 'medium';
  if (title.length <= 24) return 'short';
  if (title.length <= 42) return 'medium';
  return 'long';
}

export function QuizCoverArt({
  quiz,
  locale,
  className,
  ratioClassName,
  compact = false,
  priorityLabel,
  decorative = false,
}: QuizCoverArtProps) {
  const photo = quiz.cover_image_url?.startsWith('/stock-covers/');
  // Above-the-fold se deduce de las props sin un prop nuevo: el hero pasa
  // decorative + priorityLabel con texto y el detalle pasa priorityLabel="";
  // las tarjetas no la pasan (undefined) y quedan en lazy.
  const isHero = decorative && typeof priorityLabel === 'string' && priorityLabel.trim() !== '';
  const isAboveFold = isHero || priorityLabel === '';
  const artTitle = quiz.title.trim();
  const bucket = titleBucket(artTitle, compact);
  return (
    <div
      className={cn(
        'arcade-cover',
        quiz.quiz_type === 'trivia' && 'arcade-cover-trivia',
        ratioClassName,
        className
      )}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : quiz.title}
      aria-hidden={decorative || undefined}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={quiz.cover_image_url!}
          alt=""
          className="arcade-cover-photo"
          decoding="async"
          loading={isAboveFold ? 'eager' : 'lazy'}
          fetchPriority={isHero ? 'high' : undefined}
        />
      )}
      {priorityLabel !== '' && (
        <span className="arcade-cover-stamp">
          {priorityLabel ?? getLocalizedTypeLabel(quiz.quiz_type, locale)}
        </span>
      )}
      <strong className={cn('arcade-cover-title', `arcade-cover-title-${bucket}`)}>
        {artTitle}
      </strong>
      {!photo && bucket === 'short' && (
        <span className="arcade-cover-star" aria-hidden="true">
          ✦
        </span>
      )}
    </div>
  );
}
