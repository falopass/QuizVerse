'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import type { Category, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

const MOODS = {
  en: [
    { id: 'all', label: 'All energy' },
    { id: 'fast', label: 'Fast plays' },
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

export function ExploreCatalogPage({ locale, quizzes, categories, copy }: ExploreCatalogPageProps) {
  const [query, setQuery] = React.useState('');
  const [activeMood, setActiveMood] = React.useState<(typeof MOODS.en)[number]['id']>('all');
  const [activeCategory, setActiveCategory] = React.useState('all');
  const moods = MOODS[locale];
  const units = locale === 'es'
    ? {
        eyebrow: 'Explorar',
        visibleNow: 'Visibles ahora',
        playsInView: 'Partidas en vista',
        publishedNow: 'Publicados ahora',
        search: 'Buscar',
        categoryLanes: 'Carriles de categoría',
        leadPick: 'Selección principal',
        catalogGrid: 'Grid editorial',
        moreWaysIn: 'Más caminos de entrada',
        quizzesAfterFilters: 'quizzes tras filtros',
        min: 'min',
        plays: 'partidas',
        likes: 'me gusta',
      }
    : {
        eyebrow: 'Explore',
        visibleNow: 'Visible now',
        playsInView: 'Plays in view',
        publishedNow: 'Published now',
        search: 'Search',
        categoryLanes: 'Category lanes',
        leadPick: 'Lead pick',
        catalogGrid: 'Catalog grid',
        moreWaysIn: 'More ways in',
        quizzesAfterFilters: 'quizzes after filters',
        min: 'min',
        plays: 'plays',
        likes: 'likes',
      };

  const filteredQuizzes = React.useMemo(() => {
    let next = [...quizzes];
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
        next = [...next].sort((a, b) => b.plays_count - a.plays_count);
        break;
      default:
        next = [...next].sort((a, b) => bignessScore(b.plays_count, b.likes_count) - bignessScore(a.plays_count, a.likes_count));
    }

    return next;
  }, [activeCategory, activeMood, query, quizzes]);

  const leadQuiz = filteredQuizzes[0] ?? null;
  const secondaryQuizzes = filteredQuizzes.slice(1, 4);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 pb-20 pt-28">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface-panel p-8 md:p-10">
          <p className="eyebrow">{copy.eyebrow ?? units.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-text-primary md:text-7xl">{copy.title}</h1>
          <p className="balanced-copy mt-5 max-w-2xl text-lg text-text-secondary md:text-xl">{copy.subtitle}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard value={String(filteredQuizzes.length)} label={copy.visibleNow ?? units.visibleNow} />
          <MetricCard value={formatCompactNumber(filteredQuizzes.reduce((total, quiz) => total + quiz.plays_count, 0))} label={copy.playsInView ?? units.playsInView} />
          <MetricCard value={formatCompactNumber(quizzes.length)} label={copy.publishedNow ?? units.publishedNow} />
        </div>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{copy.searchLabel ?? units.search}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="w-full rounded-full border border-border-subtle bg-bg-primary px-5 py-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary/40" />
            </label>
            <div className="flex flex-wrap gap-2">
              {moods.map((mood) => <button key={mood.id} type="button" onClick={() => setActiveMood(mood.id)} className={cn('rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors', activeMood === mood.id ? 'border-accent-primary bg-accent-primary text-white' : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary')}>{mood.label}</button>)}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{copy.categoryLanes ?? units.categoryLanes}</p>
            <div className="flex flex-wrap gap-2">
              <CategoryFilter active={activeCategory === 'all'} label={copy.allCategories} onClick={() => setActiveCategory('all')} />
              {categories.map((category) => <CategoryFilter key={category.id} active={activeCategory === category.slug} label={`${category.icon ?? ''} ${category.name}`.trim()} onClick={() => setActiveCategory(category.slug)} />)}
            </div>
          </div>
        </div>
      </section>

      {leadQuiz ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Link href={localizeHref(locale, `/quiz/${leadQuiz.slug}`)} className="surface-panel group overflow-hidden p-6 md:p-8">
              <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#efe4d7,#d9d0c4)]">
                  {leadQuiz.cover_image_url ? <img src={leadQuiz.cover_image_url} alt={leadQuiz.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-[6rem] text-text-primary/70">{leadQuiz.category?.icon ?? 'Q'}</div>}
                </div>
                <div className="space-y-5">
                  <p className="eyebrow">{copy.leadPick ?? units.leadPick}</p>
                  <h2 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">{leadQuiz.title}</h2>
                  <p className="text-base leading-7 text-text-secondary md:text-lg">{leadQuiz.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-text-muted"><span>{leadQuiz.quiz_type}</span><span>{leadQuiz.estimated_minutes} {units.min}</span><span>{formatCompactNumber(leadQuiz.plays_count)} {units.plays}</span></div>
                </div>
              </div>
            </Link>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              {secondaryQuizzes.map((quiz) => <Link key={quiz.id} href={localizeHref(locale, `/quiz/${quiz.slug}`)} className="surface-card flex items-start gap-4 p-5 transition-transform hover:-translate-y-1"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-bg-primary text-2xl">{quiz.category?.icon ?? 'Q'}</div><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{quiz.quiz_type}</p><h3 className="mt-2 line-clamp-2 text-lg font-semibold text-text-primary">{quiz.title}</h3><p className="mt-2 text-sm text-text-secondary">{quiz.estimated_minutes} {units.min} · {formatCompactNumber(quiz.plays_count)} {units.plays}</p></div></Link>)}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div><p className="eyebrow">{units.catalogGrid}</p><h2 className="mt-2 text-4xl font-semibold tracking-tight text-text-primary">{copy.moreWaysIn ?? units.moreWaysIn}</h2></div>
              <p className="text-sm text-text-secondary">{filteredQuizzes.length} {copy.quizzesAfterFilters ?? units.quizzesAfterFilters}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredQuizzes.slice(0, 12).map((quiz) => <Link key={quiz.id} href={localizeHref(locale, `/quiz/${quiz.slug}`)} className="surface-card group overflow-hidden p-5 transition-transform hover:-translate-y-1"><div className="mb-4 flex items-center justify-between"><span className="rounded-full bg-bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{quiz.quiz_type}</span><span className="text-xl">{quiz.category?.icon ?? 'Q'}</span></div><h3 className="line-clamp-2 text-2xl font-semibold text-text-primary">{quiz.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-text-secondary">{quiz.description}</p><div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-text-muted"><span>{quiz.estimated_minutes} {units.min}</span><span>{formatCompactNumber(quiz.likes_count)} {units.likes}</span></div></Link>)}
            </div>
          </section>
        </>
      ) : (
        <section className="surface-card p-10 text-center"><h2 className="text-3xl font-semibold text-text-primary">{copy.emptyTitle}</h2><p className="mt-3 text-text-secondary">{copy.emptyBody}</p></section>
      )}
    </main>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) { return <div className="surface-card p-5"><p className="text-3xl font-semibold text-text-primary">{value}</p><p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p></div>; }
function CategoryFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={cn('rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors', active ? 'border-accent-primary bg-accent-primary text-white' : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary')}>{label}</button>; }
function bignessScore(plays: number, likes: number) { return plays * 2 + likes; }
