import Link from 'next/link';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { getArcadeCopy } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface EditorialQuizCardProps {
  quiz: Quiz;
  locale: Locale;
  index?: number;
  size?: 'hero' | 'feature' | 'default' | 'compact';
}

export function EditorialQuizCard({ quiz, locale }: EditorialQuizCardProps) {
  const copy = getArcadeCopy(locale);
  return (
    <Link href={localizeHref(locale, `/quiz/${quiz.slug}`)} className="arcade-card">
      <QuizCoverArt quiz={quiz} locale={locale} compact decorative className="arcade-card-art" />
      <div className="arcade-card-info">
        <span className="arcade-tag">{getLocalizedTypeLabel(quiz.quiz_type, locale)} / {quiz.category?.name ?? 'QuizVerse'}</span>
        <h3>{quiz.title}</h3>
        <div className="arcade-card-bottom">
          <small>{quiz.estimated_minutes} MIN</small>
          <span className="arcade-card-play">{copy.play} ↗</span>
        </div>
      </div>
    </Link>
  );
}
