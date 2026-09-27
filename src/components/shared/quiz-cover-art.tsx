import { cn } from '@/lib/utils/cn';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { getArcadeCopy } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface QuizCoverArtProps {
  quiz: Pick<Quiz, 'title' | 'quiz_type' | 'category' | 'cover_image_url'>;
  locale: Locale;
  className?: string;
  ratioClassName?: string;
  compact?: boolean;
  priorityLabel?: string;
}

export function QuizCoverArt({ quiz, locale, className, ratioClassName, compact = false, priorityLabel }: QuizCoverArtProps) {
  const photo = quiz.cover_image_url?.startsWith('/stock-covers/');
  const namedFandom = quiz.title.match(/\b(?:The Boys|Stranger Things|Star Wars|Euphoria|Mario|Re:Zero|Dr\. Stone)\b/i)?.[0];
  const copy = getArcadeCopy(locale);
  const artTitle = namedFandom && namedFandom.toLowerCase() !== quiz.title.trim().toLowerCase()
    ? namedFandom
    : quiz.quiz_type === 'personality' ? copy.coverRole : copy.coverTrivia;
  return (
    <div
      className={cn('arcade-cover', quiz.quiz_type === 'trivia' && 'arcade-cover-trivia', ratioClassName, className)}
      role="img"
      aria-label={quiz.title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={quiz.cover_image_url!} alt="" className="arcade-cover-photo" />}
      <span className="arcade-cover-stamp">{priorityLabel ?? getLocalizedTypeLabel(quiz.quiz_type, locale)}</span>
      {!photo && <strong className={cn('arcade-cover-title', compact && 'arcade-cover-title-small')}>{artTitle}</strong>}
      {!photo && <span className="arcade-cover-star" aria-hidden="true">✦</span>}
      <span className="arcade-cover-bar">{quiz.category?.name ?? getLocalizedTypeLabel(quiz.quiz_type, locale)}</span>
    </div>
  );
}
