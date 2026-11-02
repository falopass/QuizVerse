'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { localizeCategory } from '@/lib/i18n/catalog';
import { getExploreCopy } from '@/lib/i18n/explore-copy';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { AdSlot } from '@/components/shared/ad-slot';
import { editorialScore, explorerSelection } from '@/lib/quiz/editorial-order';
import type { Category, ExploreCardQuiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

/** Bajo mil partidas la cifra delata poco volumen: se omite en las tarjetas. */
const SOCIAL_PROOF_MIN_PLAYS = 1000;

/** Filas de chips: scroll horizontal con snap en móvil, envueltas desde lg. */
const CHIP_ROW_CLASS =
  'flex flex-nowrap snap-x gap-2 overflow-x-auto scroll-px-4 [scrollbar-width:none] lg:flex-wrap [&::-webkit-scrollbar]:hidden';

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

export const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/n\u0303/g, '\u00f1')
    .replace(/N\u0303/g, '\u00d1')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

interface ExploreCatalogPageProps {
  locale: Locale;
  quizzes: ExploreCardQuiz[];
  categories: Category[];
  copy: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyBody: string;
    allCategories: string;
    searchLabel?: string;
    categoryLanes?: string;
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
  const [showAll, setShowAll] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState('');
  const restRef = React.useRef<HTMLDivElement>(null);

  const moods = MOODS[locale];
  const localizedQuizzes = React.useMemo(
    () => quizzes.map((quiz) => ({ ...quiz, category: localizeCategory(quiz.category, locale) })),
    [locale, quizzes]
  );
  const localizedCategories = React.useMemo(
    () => categories.map((category) => localizeCategory(category, locale)).filter(Boolean),
    [categories, locale]
  );

  const filteredQuizzes = React.useMemo(() => {
    let next = [...localizedQuizzes];
    if (query.trim()) {
      const normalizedQuery = fold(query.trim());
      if (normalizedQuery) {
        next = next.filter(
          (quiz) =>
            fold(quiz.title).includes(normalizedQuery) ||
            fold(quiz.description ?? '').includes(normalizedQuery) ||
            quiz.tags.some((tag) => fold(tag).includes(normalizedQuery))
        );
      }
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
        next = [...next].sort(
          (a, b) => b.plays_count - a.plays_count || b.likes_count - a.likes_count
        );
        break;
      default:
        next = [...next].sort((a, b) => editorialScore(b) - editorialScore(a));
    }

    return next;
  }, [activeCategory, activeMood, localizedQuizzes, query]);

  const {
    lead: featuredLead,
    pulse: pulseQuiz,
    lanes: laneQuizzes,
    grid: gridQuizzes,
    rest: restQuizzes,
  } = React.useMemo(
    () => explorerSelection(filteredQuizzes, { preferEditorial: activeMood !== 'popular' }),
    [filteredQuizzes, activeMood]
  );

  const units = getExploreCopy(locale);

  const visibleCount =
    (featuredLead ? 1 : 0) +
    (pulseQuiz ? 1 : 0) +
    laneQuizzes.length +
    gridQuizzes.length +
    (showAll ? restQuizzes.length : 0);

  const resetExpansion = () => {
    setShowAll(false);
    setAnnouncement('');
  };

  const toggleShowAll = () => {
    const next = !showAll;
    setShowAll(next);
    setAnnouncement(
      units.showingCount(
        next ? filteredQuizzes.length : visibleCount - restQuizzes.length,
        filteredQuizzes.length
      )
    );
  };

  // Al expandir, el foco va a la primera tarjeta nueva: el botón queda antes
  // de una lista larga y el usuario de teclado no debería recorrerla entera.
  React.useEffect(() => {
    if (showAll) restRef.current?.querySelector<HTMLElement>('a')?.focus();
  }, [showAll]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-8 pb-20">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-text-primary text-[2rem] leading-tight font-semibold tracking-tight md:text-5xl">
          {copy.title}
        </h1>
        <p className="text-text-secondary max-w-2xl text-base">{copy.subtitle}</p>
      </header>

      <section className="space-y-4">
        <label className="block">
          <span className="sr-only">{copy.searchLabel ?? units.search}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetExpansion();
            }}
            placeholder={copy.searchPlaceholder}
            className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 h-12 w-full rounded-full border px-5 text-sm transition-colors outline-none"
          />
        </label>

        <div className={CHIP_ROW_CLASS} role="group" aria-label={units.moods}>
          {moods.map((mood) => (
            <FilterChip
              key={mood.id}
              active={activeMood === mood.id}
              label={mood.label}
              onClick={() => {
                setActiveMood(mood.id);
                resetExpansion();
              }}
            />
          ))}
        </div>

        <div>
          <p className="sr-only">{copy.categoryLanes ?? units.categoryLanes}</p>
          <div
            className={CHIP_ROW_CLASS}
            role="group"
            aria-label={copy.categoryLanes ?? units.categoryLanes}
          >
            <FilterChip
              active={activeCategory === 'all'}
              label={copy.allCategories}
              onClick={() => {
                setActiveCategory('all');
                resetExpansion();
              }}
            />
            {localizedCategories.map((category) => (
              <FilterChip
                key={category!.id}
                active={activeCategory === category!.slug}
                label={`${category!.icon ?? category!.name.charAt(0)} ${category!.name}`.trim()}
                onClick={() => {
                  setActiveCategory(category!.slug);
                  resetExpansion();
                }}
              />
            ))}
          </div>
        </div>

        <p role="status" aria-live="polite" className="text-text-secondary text-sm">
          {filteredQuizzes.length} {copy.quizzesAfterFilters ?? units.quizzesAfterFilters}
        </p>
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
                  <div className="border-border-subtle text-text-muted mt-6 flex items-center justify-between border-t pt-4 text-xs font-semibold">
                    <span>
                      {pulseQuiz.estimated_minutes} {units.min}
                    </span>
                    {pulseQuiz.plays_count >= SOCIAL_PROOF_MIN_PLAYS ? (
                      <span>
                        {formatCompactNumber(pulseQuiz.plays_count, locale)} {units.plays}
                      </span>
                    ) : null}
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
                <p className="text-text-muted mb-4 text-sm font-semibold">{units.leadPick}</p>
                <h2 className="text-4xl">{copy.moreWaysIn ?? units.moreWaysIn}</h2>
                <p className="text-text-secondary mt-4 text-base leading-7">{units.editorDeck}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {localizedCategories.map((category) => (
                    <Link
                      key={category!.id}
                      href={localizeHref(locale, `/category/${category!.slug}`)}
                      className="border-border-subtle text-text-secondary hover:text-text-primary bg-bg-primary inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
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

          <AdSlot placement="explore" locale={locale} />

          {gridQuizzes.length > 0 ? (
            <section className="space-y-5">
              <div className="space-y-2">
                <p className="eyebrow">{units.editorialGrid}</p>
                <h2 className="text-4xl">{units.fullCatalog}</h2>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                {gridQuizzes.map((quiz, index) => (
                  <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} index={index} />
                ))}
              </div>
              {restQuizzes.length > 0 ? (
                <>
                  <button
                    type="button"
                    aria-expanded={showAll}
                    aria-controls="explore-grid-rest"
                    onClick={toggleShowAll}
                    className="arcade-button arcade-button-lime arcade-more"
                  >
                    {showAll ? units.showLess : units.showMore(restQuizzes.length)}
                  </button>
                  <p id="explore-show-more-announcement" aria-live="polite" className="sr-only">
                    {announcement}
                  </p>
                </>
              ) : null}
              {showAll ? (
                <div
                  id="explore-grid-rest"
                  ref={restRef}
                  className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3"
                >
                  {restQuizzes.map((quiz, index) => (
                    <EditorialQuizCard
                      key={quiz.id}
                      quiz={quiz}
                      locale={locale}
                      index={gridQuizzes.length + index}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <section className="surface-card p-10 text-center">
          <h2 className="text-text-primary text-3xl font-semibold">{copy.emptyTitle}</h2>
          <p className="text-text-secondary mt-3">{copy.emptyBody}</p>
        </section>
      )}
    </div>
  );
}

function FilterChip({
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
        active
          ? 'border-accent-primary bg-accent-primary text-bg-primary'
          : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}
