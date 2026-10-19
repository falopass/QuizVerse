import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWhatsNew, partitionByRecency, type WhatsNewQuiz } from '@/lib/data/whats-new';
import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { getCategoryLabelBySlug, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbNode,
  buildGraph,
  itemListNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';

interface NovedadesPageProps {
  params: Promise<{ locale: string }>;
}

const COPY = {
  en: {
    title: "What's new on QuizVerse",
    description:
      'The latest quizzes published on QuizVerse: fresh trivia and personality tests from the last 7 days and everything released before.',
    heading: 'Fresh off the press.',
    intro:
      'Every quiz that lands on QuizVerse, newest first. Whatever dropped in the last week is up top; the rest of the catalog follows.',
    fresh: 'Last 7 days',
    older: 'Earlier',
    empty: 'Nothing published yet — check back soon.',
    home: 'Home',
  },
  es: {
    title: 'Novedades de QuizVerse',
    description:
      'Los últimos quizzes publicados en QuizVerse: trivia y tests de personalidad recién salidos en los últimos 7 días y todo lo anterior.',
    heading: 'Recién salido del horno.',
    intro:
      'Cada quiz que llega a QuizVerse, del más nuevo al más antiguo. Arriba lo publicado en la última semana; abajo, el resto del catálogo.',
    fresh: 'Últimos 7 días',
    older: 'Anteriores',
    empty: 'Todavía no hay nada publicado — vuelve pronto.',
    home: 'Inicio',
  },
} as const;

export async function generateMetadata({ params }: NovedadesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const copy = COPY[locale];

  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/novedades`,
    // La página existe en los dos idiomas: el hreflang va siempre.
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/novedades`,
    locale,
  });
}

export default async function NovedadesPage({ params }: NovedadesPageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const copy = COPY[locale];

  const quizzes = await getWhatsNew(30, locale);
  const { fresh, older } = partitionByRecency(quizzes, new Date());
  const trail = [
    { name: copy.home, href: `/${locale}` },
    { name: copy.title, href: `/${locale}/novedades` },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pt-28 pb-20">
      <JsonLd
        data={buildGraph([
          webPageNode(`/${locale}/novedades`, locale, copy.title),
          breadcrumbNode(trail.map(({ name, href }) => ({ name, path: href }))),
          itemListNode(
            quizzes.slice(0, 30).map((quiz) => ({
              name: quiz.title,
              path: quizPath(locale, quiz.slug),
            })),
            locale,
            copy.title
          ),
        ])}
      />
      <Breadcrumbs locale={locale} items={trail} className="mb-6" />
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{copy.title}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {copy.heading}
        </h1>
        <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">{copy.intro}</p>
      </section>

      {quizzes.length === 0 ? (
        <section className="surface-card mt-8 p-6">
          <p className="text-text-secondary text-sm leading-6">{copy.empty}</p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="text-accent-primary mt-3 inline-block text-sm font-semibold"
          >
            {locale === 'es' ? 'Explorar quizzes' : 'Explore quizzes'}
          </Link>
        </section>
      ) : (
        <>
          <RecencyGroup title={copy.fresh} items={fresh} locale={locale} />
          {older.length > 0 ? (
            <RecencyGroup title={copy.older} items={older} locale={locale} />
          ) : null}
        </>
      )}
    </main>
  );
}

function RecencyGroup({
  title,
  items,
  locale,
}: {
  title: string;
  items: WhatsNewQuiz[];
  locale: Locale;
}) {
  return (
    <section className="mt-10">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((quiz) => (
          <WhatsNewCard key={quiz.slug} quiz={quiz} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function WhatsNewCard({ quiz, locale }: { quiz: WhatsNewQuiz; locale: Locale }) {
  const publishedAt = new Date(quiz.published_at ?? quiz.created_at);

  return (
    <article className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <Link href={localizeHref(locale, `/quiz/${quiz.slug}`)} className="group min-w-0 flex-1">
        <h3 className="text-text-primary group-hover:text-accent-primary truncate text-lg font-semibold transition-colors">
          {quiz.title}
        </h3>
        <p className="text-text-muted mt-1 text-xs font-semibold tracking-[0.14em] uppercase">
          {getLocalizedTypeLabel(quiz.quiz_type, locale)} · {quiz.estimated_minutes} min ·{' '}
          <time dateTime={publishedAt.toISOString()}>
            {publishedAt.toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </time>
        </p>
      </Link>
      {quiz.category ? (
        <Link
          href={localizeHref(locale, `/category/${quiz.category.slug}`)}
          className="text-accent-primary shrink-0 text-sm font-semibold"
        >
          {getCategoryLabelBySlug(quiz.category.slug, locale)}
        </Link>
      ) : null}
    </article>
  );
}
