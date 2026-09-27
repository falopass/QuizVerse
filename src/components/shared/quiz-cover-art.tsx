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
}

export function QuizCoverArt({ quiz, locale, className, ratioClassName, compact = false, priorityLabel }: QuizCoverArtProps) {
  const photo = quiz.cover_image_url?.startsWith('/stock-covers/');
  const artTitle = quiz.title.trim();
  return (
    <div
      className={cn('arcade-cover', quiz.quiz_type === 'trivia' && 'arcade-cover-trivia', ratioClassName, className)}
      role="img"
      aria-label={quiz.title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={quiz.cover_image_url!} alt="" className="arcade-cover-photo" />}
      {priorityLabel !== '' && <span className="arcade-cover-stamp">{priorityLabel ?? getLocalizedTypeLabel(quiz.quiz_type, locale)}</span>}
      <strong className={cn('arcade-cover-title', (compact || artTitle.length > 22) && 'arcade-cover-title-small')}>{artTitle}</strong>
      <span className="arcade-cover-edition" aria-hidden="true">{quiz.slug.replaceAll('-', ' ')}</span>
      {!photo && <span className="arcade-cover-star" aria-hidden="true">✦</span>}
    </div>
  );
}
