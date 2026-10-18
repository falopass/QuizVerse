'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { localizeCategory, localizeQuizList } from '@/lib/i18n/catalog';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import type { Category, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

const MOODS = {
  en: [
    { id: 'all', label: 'All energy' },
    { id: 'fast', label: 'Quick plays' },
    { id: 'personality', label: 'Personality' },
    { id: 'trivia', label: 'Trivia' },
    { id: 'popular', label: 'Most played' },
  ],
  es: [
    { id: 'all', label: 'Toda la energía' },
    { id: 'fast', label: 'Partidas rápidas' },
    { id: 'personality', label: 'Personalidad' },
    { id: 'trivia', label: 'Trivia' },
    { id: 'popular', label: 'Más jugados' },
  ],
} as const;

interface ExploreCatalogPageProps {
  locale: Locale;
  quizzes: Quiz[];
  categories: Category[];
  copy: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyBody: string;
    allCategories: string;
    eyebrow?: string;
    visibleNow?: string;
    playsInView?: string;
    publishedNow?: string;
    searchLabel?: string;
    categoryLanes?: string;
    leadPick?: string;
    moreWaysIn?: string;
    quizzesAfterFilters?: string;
  };
}

export function ExploreEditorialPage({
  locale,
  quizzes,
  categories,
  copy,
}: ExploreCatalogPageProps) {
  const [query, setQuery] = React.useState('');
  const [activeMood, setActiveMood] = React.useState<(typeof MOODS.en)[number]['id']>('all');
  const [activeCategory, setActiveCategory] = React.useState('all');

  const moods = MOODS[locale];
  const localizedQuizzes = React.useMemo(
    () => localizeQuizList(quizzes, locale),
    [locale, quizzes]
  );
  const localizedCategories = React.useMemo(
    () => categories.map((category) => localizeCategory(category, locale)).filter(Boolean),
    [categories, locale]
  );

  const filteredQuizzes = React.useMemo(() => {
    let next = [...localizedQuizzes];
    if (query.trim()) {
      const normalizedQuery = query.trim().toLowerCase();
      next = next.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(normalizedQuery) ||
          (quiz.description ?? '').toLowerCase().includes(normalizedQuery) ||
          quiz.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    }

    if (activeCategory !== 'all') {
      next = next.filter((quiz) => quiz.category?.slug === activeCategory);
    }

    switch (activeMood) {
      case 'fast':
        next = next.filter((quiz) => quiz.estimated_minutes <= 4);
        break;
      case 'personality':
        next = next.filter((quiz) => quiz.quiz_type === 'personality');
        break;
      case 'trivia':
        next = next.filter((quiz) => quiz.quiz_type === 'trivia');
        break;
      case 'popular':
        next = [...next].sort((a, b) => editorialScore(b) - editorialScore(a));
        break;
      default:
        next = [...next].sort((a, b) => editorialScore(b) - editorialScore(a));
    }

    return next;
  }, [activeCategory, activeMood, localizedQuizzes, query]);

  const featuredLead =
    filteredQuizzes.find((quiz) => quiz.is_featured) ?? filteredQuizzes[0] ?? null;
  const pulseQuiz =
    filteredQuizzes
      .filter((quiz) => quiz.id !== featuredLead?.id)
      .sort((a, b) => editorialScore(b) - editorialScore(a))[0] ?? null;
  const secondaryPool = filteredQuizzes.filter(
    (quiz) => quiz.id !== featuredLead?.id && quiz.id !== pulseQuiz?.id
  );
  const laneQuizzes = secondaryPool.slice(0, 4);
  const gridQuizzes = secondaryPool.slice(4, 16);

  const units =
    locale === 'es'
      ? {
          eyebrow: 'Explorar',
          visibleNow: 'Visibles ahora',
          playsInView: 'Partidas en vista',
          publishedNow: 'Publicados ahora',
          search: 'Buscar',
          categoryLanes: 'Carriles editoriales',
          leadPick: 'Selección principal',
          pulse: 'Pulso del momento',
          moreWaysIn: 'Más caminos de entrada',
          quizzesAfterFilters: 'quizzes tras filtros',
          editorialGrid: 'Entradas curadas',
          editorDeck:
            'No es solo volumen: ahora el catálogo prioriza quizzes con una promesa más clara, mejor ritmo y mejor superficie visual.',
          min: 'min',
          plays: 'partidas',
          open: 'Abrir',
          lanesTitle: 'Los mejores caminos para entrar',
          pulseDeck:
            'La segunda carta fuerte no debería perderse en una grilla plana. Aquí le damos un espacio propio para convertir mejor.',
        }
      : {
          eyebrow: 'Explore',
          visibleNow: 'Visible now',
          playsInView: 'Plays in view',
          publishedNow: 'Published now',
          search: 'Search',
          categoryLanes: 'Editorial lanes',
          leadPick: 'Lead pick',
          pulse: 'Now in pulse',
          moreWaysIn: 'More ways in',
          quizzesAfterFilters: 'quizzes after filters',
          editorialGrid: 'Curated entries',
          editorDeck:
            'This is not just volume. The catalog now surfaces quizzes with a stronger promise, better pacing and cleaner visual priority.',
          min: 'min',
          plays: 'plays',
          open: 'Open',
          lanesTitle: 'The best ways in',
          pulseDeck:
            'The second-strongest quiz should not disappear inside a flat grid, so it gets its own selling space here.',
        };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 pt-28 pb-20">
      <section className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-panel p-8 md:p-10">
          <p className="eyebrow">{copy.eyebrow ?? units.eyebrow}</p>
          <h1 className="text-text-primary mt-4 max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
            {copy.title}
          </h1>
          <p className="balanced-copy text-text-secondary mt-5 max-w-2xl text-lg md:text-xl">
            {copy.subtitle}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-3">
          <MetricCard
            value={String(filteredQuizzes.length)}
            label={copy.visibleNow ?? units.visibleNow}
          />
          <MetricCard
            value={formatCompactNumber(
              filteredQuizzes.reduce((total, quiz) => total + quiz.plays_count, 0)
            )}
            label={copy.playsInView ?? units.playsInView}
          />
          <MetricCard
            value={formatCompactNumber(localizedQuizzes.length)}
            label={copy.publishedNow ?? units.publishedNow}
          />
        </div>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-text-muted mb-2 block text-[11px] font-semibold tracking-[0.2em] uppercase">
                {copy.searchLabel ?? units.search}
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 w-full rounded-full border px-5 py-4 text-sm transition-colors outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {moods.map((mood) => (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => setActiveMood(mood.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors',
                    activeMood === mood.id
                      ? 'border-accent-primary bg-accent-primary text-white'
                      : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary'
                  )}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
              {copy.categoryLanes ?? units.categoryLanes}
            </p>
            <div className="flex flex-wrap gap-2">
              <CategoryFilter
                active={activeCategory === 'all'}
                label={copy.allCategories}
                onClick={() => setActiveCategory('all')}
              />
              {localizedCategories.map((category) => (
                <CategoryFilter
                  key={category!.id}
                  active={activeCategory === category!.slug}
                  label={`${category!.icon ?? category!.name.charAt(0)} ${category!.name}`.trim()}
                  onClick={() => setActiveCategory(category!.slug)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {featuredLead ? (
        <>
          <section className="grid items-start gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <EditorialQuizCard quiz={featuredLead} locale={locale} size="hero" />

            <div className="grid items-start gap-6 self-start md:grid-cols-2">
              {pulseQuiz ? (
                <div className="surface-panel flex flex-col justify-between rounded-[2rem] p-6 md:p-7">
                  <div>
                    <p className="eyebrow mb-3">{units.pulse}</p>
                    <h2 className="text-[2.2rem]">{pulseQuiz.title}</h2>
                    <p className="text-text-secondary mt-4 text-base leading-7">
                      {pulseQuiz.description}
                    </p>
                    <p className="text-text-secondary mt-5 text-sm leading-6">{units.pulseDeck}</p>
                  </div>
                  <div className="border-border-subtle text-text-muted mt-6 flex items-center justify-between border-t pt-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
                    <span>
                      {pulseQuiz.estimated_minutes} {units.min}
                    </span>
                    <span>
                      {formatCompactNumber(pulseQuiz.plays_count)} {units.plays}
                    </span>
                    <Link
                      href={localizeHref(locale, `/quiz/${pulseQuiz.slug}`)}
                      className="text-accent-primary"
                    >
                      {units.open}
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="surface-card rounded-[2rem] p-6 md:p-7">
                <p className="eyebrow mb-4">{units.leadPick}</p>
                <h2 className="text-4xl">{copy.moreWaysIn ?? units.moreWaysIn}</h2>
                <p className="text-text-secondary mt-4 text-base leading-7">{units.editorDeck}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {localizedCategories.slice(0, 4).map((category) => (
                    <Link
                      key={category!.id}
                      href={localizeHref(locale, `/category/${category!.slug}`)}
                      className="border-border-subtle text-text-secondary hover:text-text-primary bg-bg-primary rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
                    >
                      {category!.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {laneQuizzes.length > 0 ? (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">{units.categoryLanes}</p>
                  <h2 className="mt-2 text-4xl">{units.lanesTitle}</h2>
                </div>
                <p className="text-text-secondary text-sm">
                  {filteredQuizzes.length} {copy.quizzesAfterFilters ?? units.quizzesAfterFilters}
                </p>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
                {laneQuizzes.map((quiz, index) => (
                  <EditorialQuizCard
                    key={quiz.id}
                    quiz={quiz}
                    locale={locale}
                    index={index}
                    size="compact"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {gridQuizzes.length > 0 ? (
            <section className="space-y-5">
              <div className="space-y-2">
                <p className="eyebrow">{units.editorialGrid}</p>
                <h2 className="text-4xl">{copy.moreWaysIn ?? units.moreWaysIn}</h2>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                {gridQuizzes.map((quiz, index) => (
                  <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} index={index} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="surface-card p-10 text-center">
          <h2 className="text-text-primary text-3xl font-semibold">{copy.emptyTitle}</h2>
          <p className="text-text-secondary mt-3">{copy.emptyBody}</p>
        </section>
      )}
    </main>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-text-primary text-3xl font-semibold">{value}</p>
      <p className="text-text-muted mt-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </p>
    </div>
  );
}

function CategoryFilter({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors',
        active
          ? 'border-accent-primary bg-accent-primary text-white'
          : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}

function editorialScore(quiz: Quiz) {
  const featuredBoost = quiz.is_featured ? 220 : 0;
  const stockBoost = quiz.cover_image_url?.startsWith('/stock-covers/') ? 28 : 0;
  const personalityBoost = quiz.quiz_type === 'personality' ? 6 : 0;
  return (
    featuredBoost + stockBoost + quiz.plays_count * 2 + quiz.likes_count * 4 + personalityBoost
  );
}
