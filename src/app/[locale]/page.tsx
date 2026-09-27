import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getHomePayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeQuizList } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { generateQuizMetadata } from '@/lib/seo/metadata';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';

interface LocalePageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  return { ...generateQuizMetadata({
    title: locale === 'es' ? 'QuizVerse en Español' : 'QuizVerse',
    description: locale === 'es'
      ? 'Quizzes de cultura pop, trivia y personalidad para jugar y compartir.'
      : 'Pop culture quizzes, trivia and personality games to play and share.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale}`,
    locale,
  }), title: { absolute: locale === 'es' ? 'QuizVerse en Español' : 'QuizVerse' } };
}

export default async function LocalizedHomePage({ params }: LocalePageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const payload = await getHomePayload(locale);
  const quizzes = [...new Map(localizeQuizList([
    ...payload.featured, ...payload.trending, ...payload.quickPlays, ...payload.freshlyPublished,
  ], locale).map((quiz) => [quiz.id, quiz])).values()];
  const lead = quizzes[0];
  const games = quizzes.filter((quiz) => quiz.id !== lead?.id);

  return (
    <div className="arcade-wrap arcade-page">
      <section className="arcade-hero">
        <div className="arcade-hero-copy">
          <span className="arcade-live">● {dictionary.home.sections.discovery}</span>
          <h1>{dictionary.arcade.heroTitle}</h1>
          <p>{dictionary.arcade.heroBody}</p>
          <Link href={lead ? localizeHref(locale, `/quiz/${lead.slug}/play`) : localizeHref(locale, '/quiz')} className="arcade-button arcade-button-pink">
            {lead ? dictionary.arcade.playFeatured : dictionary.arcade.pickGame} <span>↗</span>
          </Link>
        </div>
        {lead ? (
          <Link href={localizeHref(locale, `/quiz/${lead.slug}`)} className="arcade-hero-link" aria-label={lead.title}>
            <QuizCoverArt quiz={lead} locale={locale} priorityLabel={`${dictionary.arcade.featured} / 001`} className="arcade-hero-art" />
          </Link>
        ) : <div className="arcade-hero-empty" aria-hidden="true">QUIZVERSE</div>}
      </section>
      <div className="arcade-strip">
        <span>{dictionary.arcade.stripStart}</span><span>{dictionary.arcade.stripMiddle}</span><span>{dictionary.arcade.stripEnd}</span>
      </div>
      <section id="games" className="arcade-games">
        <div className="arcade-section-head"><h2>{dictionary.arcade.chooseGame}</h2><p>{dictionary.arcade.chooseBody}</p></div>
        <div className="arcade-grid">
          {games.slice(0, 9).map((quiz) => <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} />)}
        </div>
        <Link href={localizeHref(locale, '/quiz')} className="arcade-button arcade-button-lime arcade-more">{dictionary.common.explore} ↗</Link>
      </section>
    </div>
  );
}
