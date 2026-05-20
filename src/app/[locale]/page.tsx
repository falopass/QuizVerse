import Link from 'next/link';
import type { Metadata } from 'next';
import { getHomePayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeCategory, localizeQuizList } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { notFound } from 'next/navigation';
import { generateQuizMetadata } from '@/lib/seo/metadata';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  return generateQuizMetadata({
    title: locale === 'es' ? 'QuizVerse en Español' : 'QuizVerse',
    description:
      locale === 'es'
        ? 'Quizzes editoriales, trivia y tests de personalidad diseñados para jugarse y compartirse.'
        : 'Editorial quizzes, trivia and personality tests designed to be played and shared.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale}`,
    locale,
  });
}

export default async function LocalizedHomePage({ params }: LocalePageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const payload = await getHomePayload(locale);
  const categories = payload.categories
    .map((category) => localizeCategory(category, locale))
    .filter(Boolean);
  const featured = localizeQuizList(payload.featured, locale).sort(
    (a, b) => editorialScore(b) - editorialScore(a)
  );
  const trending = localizeQuizList(payload.trending, locale).sort(
    (a, b) => editorialScore(b) - editorialScore(a)
  );
  const quickPlays = localizeQuizList(payload.quickPlays, locale).sort(
    (a, b) => editorialScore(b) - editorialScore(a)
  );
  const freshlyPublished = localizeQuizList(payload.freshlyPublished, locale).sort(
    (a, b) => editorialScore(b) - editorialScore(a)
  );
  const leadQuiz = featured[0] ?? trending[0] ?? quickPlays[0] ?? null;
  const supportRail = uniqueById([
    ...featured.slice(1),
    ...trending.slice(0, 4),
    ...quickPlays.slice(0, 3),
  ])
    .filter((quiz) => quiz.id !== leadQuiz?.id)
    .sort((a, b) => editorialScore(b) - editorialScore(a))
    .slice(0, 3);
  const standoutStrip = uniqueById([...featured, ...trending, ...quickPlays])
    .sort((a, b) => editorialScore(b) - editorialScore(a))
    .slice(0, 5);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-14 px-4 pt-28 pb-20">
      <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div className="space-y-8">
          <div className="kicker eyebrow animate-editorial-rise">
            <span className="bg-accent-primary h-2 w-2 rounded-full" />
            {dictionary.home.eyebrow}
          </div>

          <div className="space-y-5">
            <h1 className="max-w-4xl text-5xl sm:text-6xl lg:text-8xl">
              {dictionary.home.title}{' '}
              <span className="headline-gradient">{dictionary.home.titleAccent}</span>
            </h1>
            <p className="balanced-copy text-text-secondary text-lg leading-8 sm:text-xl">
              {dictionary.home.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={localizeHref(locale, '/quiz')}
              className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold tracking-[0.18em] text-white uppercase transition-colors"
            >
              {dictionary.home.primaryCta}
            </Link>
            <Link
              href={localizeHref(locale, '/create/ai')}
              className="border-border-subtle bg-bg-secondary text-text-primary hover:border-accent-primary/30 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold tracking-[0.18em] uppercase transition-colors"
            >
              {dictionary.home.secondaryCta}
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {categories.slice(0, 3).map((category) => (
              <Link
                key={category!.id}
                href={localizeHref(locale, `/category/${category!.slug}`)}
                className="surface-card rounded-[2rem] p-5 transition-transform hover:-translate-y-1"
              >
                <p className="eyebrow mb-4">{dictionary.home.sections.categories}</p>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-[1.9rem] leading-none tracking-tight sm:text-[2rem]">
                    {category!.name}
                  </h2>
                  <span className="text-text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-lg">
                    {category!.icon ?? category!.name.charAt(0)}
                  </span>
                </div>
                <p className="text-text-secondary text-sm leading-6">{category!.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.62fr_0.38fr] lg:grid-rows-[auto_auto]">
          {leadQuiz ? (
            <div className="lg:row-span-2">
              <EditorialQuizCard quiz={leadQuiz} locale={locale} size="hero" />
            </div>
          ) : null}
          <aside className="surface-card rounded-[2rem] p-6">
            <p className="eyebrow mb-3">{dictionary.home.sections.momentum}</p>
            <h2 className="mb-2 text-3xl">
              {payload.totalPlays.toLocaleString(locale)} {locale === 'es' ? 'partidas' : 'plays'}
            </h2>
            <p className="text-text-secondary">{dictionary.home.featuredBody}</p>
          </aside>
          <aside className="surface-panel rounded-[2rem] p-6">
            <p className="eyebrow mb-3">{dictionary.home.sections.discovery}</p>
            <h2 className="mb-2 text-3xl">
              {payload.totalQuizzes} {locale === 'es' ? 'quizzes en vivo' : 'live quizzes'}
            </h2>
            <p className="text-text-secondary">{dictionary.home.quickBody}</p>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="surface-panel rounded-[2rem] p-6 md:p-7">
          <p className="eyebrow mb-4">
            {locale === 'es' ? 'Selección editorial' : 'Editorial picks'}
          </p>
          <h2 className="text-4xl">
            {locale === 'es'
              ? 'Entradas más fuertes para empezar a jugar'
              : 'Sharper entry points into the catalog'}
          </h2>
          <p className="text-text-secondary mt-4 text-base leading-7">
            {locale === 'es'
              ? 'En lugar de empujar un grid plano, priorizamos picks con más ritmo, personalidad y conversación cultural real.'
              : 'Instead of a flat catalog wall, we push picks with stronger pacing, personality and live cultural momentum.'}
          </p>
          <div className="mt-6 grid gap-3">
            {standoutStrip.slice(0, 3).map((quiz) => (
              <Link
                key={`${locale}-standout-${quiz.id}`}
                href={localizeHref(locale, `/quiz/${quiz.slug}`)}
                className="border-border-subtle hover:border-accent-primary/30 flex items-center justify-between rounded-[1.4rem] border bg-white/70 px-4 py-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
                    {quiz.category?.name ?? (locale === 'es' ? 'Quiz' : 'Quiz')}
                  </p>
                  <p className="text-text-primary mt-2 line-clamp-2 text-base leading-6 font-semibold">
                    {quiz.title}
                  </p>
                </div>
                <span className="text-accent-primary ml-4 text-sm font-semibold">
                  {locale === 'es' ? 'Ver' : 'Open'}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {supportRail.map((quiz, index) => (
            <EditorialQuizCard
              key={`${locale}-support-${quiz.id}`}
              quiz={quiz}
              locale={locale}
              index={index}
              size="compact"
            />
          ))}
        </div>
      </section>

      <HomeQuizSection
        locale={locale}
        title={locale === 'es' ? 'Ahora en tendencia' : 'Trending now'}
        eyebrow={dictionary.home.sections.momentum}
        deck={
          locale === 'es'
            ? 'Lo más visible, lo más jugado y lo que mejor entra hoy.'
            : 'What is landing fastest, earning plays and carrying the strongest pull today.'
        }
        quizzes={trending}
      />
      <HomeQuizSection
        locale={locale}
        title={locale === 'es' ? 'Partidas rápidas' : 'Fast plays'}
        eyebrow={dictionary.home.sections.discovery}
        deck={
          locale === 'es'
            ? 'Quizzes de entrada veloz para jugar sin fricción y seguir descubriendo.'
            : 'Quick-entry quizzes built for low friction, fast reads and another click.'
        }
        quizzes={quickPlays}
      />
      <HomeQuizSection
        locale={locale}
        title={locale === 'es' ? 'Recién publicados' : 'Freshly published'}
        eyebrow={dictionary.home.sections.discovery}
        deck={
          locale === 'es'
            ? 'Nuevos experimentos, drafts pulidos y temas recién sembrados en el catálogo.'
            : 'New experiments, polished drafts and newly seeded topics entering the catalog.'
        }
        quizzes={freshlyPublished}
      />
    </main>
  );
}

function HomeQuizSection({
  locale,
  title,
  eyebrow,
  deck,
  quizzes,
}: {
  locale: 'en' | 'es';
  title: string;
  eyebrow: string;
  deck: string;
  quizzes: Awaited<ReturnType<typeof getHomePayload>>['trending'];
}) {
  const [lead, ...rest] = quizzes;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="text-4xl">{title}</h2>
        </div>
        <p className="text-text-secondary max-w-2xl text-sm leading-6">{deck}</p>
      </div>
      {lead ? (
        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <EditorialQuizCard quiz={lead} locale={locale} size="feature" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
            {rest.slice(0, 4).map((quiz, index) => (
              <EditorialQuizCard
                key={`${locale}-${title}-${quiz.id}`}
                quiz={quiz}
                index={index}
                locale={locale}
                size="compact"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function editorialScore(quiz: Awaited<ReturnType<typeof getHomePayload>>['trending'][number]) {
  const featuredBoost = quiz.is_featured ? 220 : 0;
  const stockBoost = quiz.cover_image_url?.startsWith('/stock-covers/') ? 28 : 0;
  const personalityBoost = quiz.quiz_type === 'personality' ? 6 : 0;
  return (
    featuredBoost + stockBoost + quiz.plays_count * 2 + quiz.likes_count * 4 + personalityBoost
  );
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
