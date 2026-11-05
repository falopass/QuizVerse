import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryCounts } from '@/lib/data/category-counts';
import { getHomePayload, getLaunchHomePayload } from '@/lib/data/public';
import { dailyPickCopy, pickDailyTriviaQuiz } from '@/lib/content/daily-pick';
import { collectHomeQuizzes } from '@/lib/data/daily-quiz';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeCategory } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { homeOgImage } from '@/lib/seo/site';
import { buildGraph, categoryPath, itemListNode, webPageNode } from '@/lib/seo/structured-data';
import { CategoryStrip } from '@/components/home/category-strip';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { RecentlyPlayed } from '@/components/home/recently-played';
import { JsonLd } from '@/components/seo/json-ld';
import { AdSlot } from '@/components/shared/ad-slot';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

const HOME_COPY = {
  en: {
    title: 'QuizVerse — Free personality quizzes and trivia',
    description:
      'Play free personality tests, trivia and fandom quizzes in English and Spanish. Pick a game, answer fast and share a result worth posting.',
  },
  es: {
    title: 'QuizVerse — Tests de personalidad, trivia y quizzes gratis',
    description:
      'Juega tests de personalidad, trivia y quizzes de fandom gratis en español e inglés. Elige un juego, responde rápido y comparte tu resultado.',
  },
} as const;

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const copy = HOME_COPY[locale];

  return buildMetadata({
    title: copy.title,
    absoluteTitle: true,
    description: copy.description,
    path: `/${locale}`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}`,
    locale,
    image: homeOgImage(locale),
    imageAlt: 'QuizVerse',
  });
}

export default async function LocalizedHomePage({ params }: LocalePageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  // Si el payload falla entero (Supabase caído), la home sirve el catálogo de
  // lanzamiento como la ficha de quiz, en vez de la página de error.
  const [payload, localeCounts] = await Promise.all([
    getHomePayload(locale).catch(() => getLaunchHomePayload(locale)),
    getCategoryCounts(locale),
  ]);
  const quizzes = collectHomeQuizzes(payload, locale);
  const lead = quizzes[0];
  const today = new Date();
  // El pick es independiente por idioma: los candidatos son el catálogo de este
  // locale y forzar el par traducido exigiría consultar también el del otro.
  const dailyQuiz = pickDailyTriviaQuiz(quizzes, today);
  const dailyCopy = dailyQuiz ? dailyPickCopy(locale, today) : null;
  const games = quizzes.filter((quiz) => quiz.id !== lead?.id && quiz.id !== dailyQuiz?.id);
  const homeCategories = payload.categories
    .map((category) => ({ ...category, quiz_count: localeCounts.get(category.slug) ?? 0 }))
    .filter((category) => category.quiz_count > 0)
    .sort((a, b) => b.quiz_count - a.quiz_count)
    .slice(0, 16);
  const categoryItems = homeCategories.map((category) => ({
    name: localizeCategory(category, locale)?.name ?? category.name,
    path: categoryPath(locale, category.slug),
  }));

  return (
    <div className="arcade-wrap arcade-page">
      <JsonLd
        data={buildGraph([
          webPageNode(`/${locale}`, locale, HOME_COPY[locale].title),
          itemListNode(
            categoryItems,
            locale,
            locale === 'es' ? 'Categorías de QuizVerse' : 'QuizVerse categories'
          ),
        ])}
      />
      <section className="arcade-hero">
        <div className="arcade-hero-copy">
          <span className="arcade-live">● {dictionary.home.sections.discovery}</span>
          <h1>{dictionary.arcade.heroTitle}</h1>
          <p>{dictionary.arcade.heroBody}</p>
          <Link
            href={
              lead
                ? localizeHref(locale, `/quiz/${lead.slug}/play?mode=classic`)
                : localizeHref(locale, '/quiz')
            }
            className="arcade-button arcade-button-pink"
          >
            {lead ? dictionary.arcade.playFeatured : dictionary.arcade.pickGame} <span>↗</span>
          </Link>
        </div>
        {lead ? (
          <Link
            href={localizeHref(locale, `/quiz/${lead.slug}`)}
            className="arcade-hero-link"
            aria-label={`${dictionary.arcade.featured} / 001 ${lead.title}`}
          >
            <QuizCoverArt
              quiz={lead}
              locale={locale}
              decorative
              priorityLabel={`${dictionary.arcade.featured} / 001`}
              className="arcade-hero-art"
            />
          </Link>
        ) : (
          <div className="arcade-hero-empty" aria-hidden="true">
            QUIZVERSE
          </div>
        )}
      </section>
      <AdSlot placement="home" locale={locale} />
      <div className="arcade-strip">
        <span>{dictionary.arcade.stripStart}</span>
        <span>{dictionary.arcade.stripMiddle}</span>
        <span>{dictionary.arcade.stripEnd}</span>
      </div>
      {dailyQuiz && dailyCopy ? (
        <section className="arcade-related">
          <div className="arcade-section-head">
            <div>
              <span className="arcade-tag">
                {dailyCopy.eyebrow} · {dailyCopy.dateLabel}
              </span>
              <h2>{dailyCopy.title}</h2>
            </div>
            <p>{dailyCopy.body}</p>
          </div>
          <div className="arcade-grid">
            <EditorialQuizCard quiz={dailyQuiz} locale={locale} />
          </div>
          <Link
            href={localizeHref(locale, '/daily')}
            className="arcade-button arcade-button-lime arcade-more"
          >
            {dictionary.common.playNow} ↗
          </Link>
        </section>
      ) : null}
      <RecentlyPlayed locale={locale} />
      <section id="games" className="arcade-games">
        <div className="arcade-section-head">
          <h2>{dictionary.arcade.chooseGame}</h2>
          <p>{dictionary.arcade.chooseBody}</p>
        </div>
        <div className="arcade-grid">
          {games.slice(0, 9).map((quiz) => (
            <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} />
          ))}
        </div>
        <div className="arcade-more flex flex-wrap items-center gap-4">
          <Link href={localizeHref(locale, '/quiz')} className="arcade-button arcade-button-lime">
            {dictionary.common.explore} ↗
          </Link>
          <Link
            href={localizeHref(locale, '/novedades')}
            className="text-accent-primary text-xs font-semibold"
          >
            {locale === 'es' ? 'Ver novedades' : "What's new"} ↗
          </Link>
        </div>
      </section>
      <CategoryStrip categories={homeCategories} locale={locale} />
    </div>
  );
}
