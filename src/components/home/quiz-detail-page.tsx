import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { ReportButton } from '@/components/shared/report-button';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getPublishedQuizzes, getQuizBySlug, getRelatedQuizzes } from '@/lib/data/public';
import { getStockCoverEntry } from '@/lib/data/stock-cover-manifest';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocaleFromParam } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/navigation';
import { getLocalizedLanguageLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';

interface QuizDetailPageProps { params: Promise<{ locale?: string; slug: string }> }

export async function generateQuizDetailStaticParams() {
  try {
    const quizzes = await getPublishedQuizzes(80);
    return quizzes.map((quiz) => ({ slug: quiz.slug }));
  } catch {
    return LAUNCH_QUIZZES.map((quiz) => ({ slug: quiz.slug }));
  }
}

export async function QuizDetailPage({ params }: QuizDetailPageProps) {
  const { slug, locale: localeParam } = await params;
  const locale = getLocaleFromParam(localeParam);
  const dictionary = await getDictionary(locale);
  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) notFound();
  const related = await getRelatedQuizzes(quiz.slug, quiz.category?.slug, locale);
  const stockCover = getStockCoverEntry(quiz.slug);

  return (
    <div className="arcade-wrap arcade-page arcade-detail-page">
      <section className="arcade-detail">
        <div>
          <QuizCoverArt quiz={quiz} locale={locale} className="arcade-detail-art" priorityLabel={getLocalizedTypeLabel(quiz.quiz_type, locale)} />
          {stockCover && quiz.cover_image_url?.startsWith('/stock-covers/') && <p className="arcade-attribution">{stockCover.attribution}</p>}
        </div>
        <div className="arcade-detail-copy">
          <Link href={localizeHref(locale, '/quiz')} className="arcade-back">{dictionary.arcade.backGames}</Link>
          <h1>{quiz.title}</h1>
          <p>{quiz.description}</p>
          <Link href={localizeHref(locale, `/quiz/${quiz.slug}/play`)} className="arcade-button arcade-button-lime arcade-start">
            {dictionary.arcade.startPlaying} <span>↗</span>
          </Link>
          <dl className="arcade-facts">
            <div><dt>{dictionary.arcade.gameType}</dt><dd>{getLocalizedTypeLabel(quiz.quiz_type, locale)}</dd></div>
            <div><dt>{dictionary.arcade.time}</dt><dd>{quiz.estimated_minutes} min</dd></div>
            <div><dt>{dictionary.arcade.language}</dt><dd>{getLocalizedLanguageLabel(quiz.language, locale)}</dd></div>
          </dl>
          <div className="arcade-report"><ReportButton quizId={quiz.id} quizSlug={quiz.slug} locale={locale} /></div>
        </div>
      </section>
      {related.length > 0 && <section className="arcade-related">
        <div className="arcade-section-head"><h2>{dictionary.arcade.related}</h2></div>
        <div className="arcade-grid">{related.slice(0, 3).map((item) => <EditorialQuizCard key={item.id} quiz={item} locale={locale} />)}</div>
      </section>}
    </div>
  );
}
