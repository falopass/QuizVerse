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
import { foldSearchText, matchesSearchIndex, searchIndexText } from '@/lib/catalog/search-index';
import type { CatalogCard, CatalogPage } from '@/lib/data/catalog';
import type { Category, ExploreCardQuiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

/** Bajo mil partidas la cifra delata poco volumen: se omite en las tarjetas. */
const SOCIAL_PROOF_MIN_PLAYS = 1000;

/** Tamaño de página al pedir resultados adicionales a `GET /api/quizzes`. */
const REMOTE_PAGE_LIMIT = 24;

/** Límite máximo de `q` aceptado por `QuizQuerySchema`. */
const REMOTE_QUERY_MAX_LEN = 60;

/** Filas de chips: scroll horizontal con snap en móvil, envueltas desde lg. */
const CHIP_ROW_CLASS =
  'flex flex-nowrap snap-x gap-2 overflow-x-auto scroll-px-4 [scrollbar-width:none] lg:flex-wrap [&::-webkit-scrollbar]:hidden';

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary';

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

type MoodId = (typeof MOODS.en)[number]['id'];

const VALID_MOODS = new Set<MoodId>(['all', 'fast', 'personality', 'trivia', 'popular']);

function parseUrlState(search: string): {
  q: string;
  category: string;
  mood: MoodId;
} {
  const params = new URLSearchParams(search);
  const rawQ = params.get('q') ?? '';
  const rawCategory = params.get('category')?.trim() ?? 'all';
  const rawMood = (params.get('mood')?.trim() ?? 'all') as MoodId;

  return {
    q: rawQ,
    category: /^[a-z0-9-]{1,60}$/.test(rawCategory) ? rawCategory : 'all',
    mood: VALID_MOODS.has(rawMood) ? rawMood : 'all',
  };
}

function buildFilterSearch(q: string, category: string, mood: MoodId): string {
  const params = new URLSearchParams();
  const trimmedQ = q.trim();
  if (trimmedQ) params.set('q', trimmedQ);
  if (category !== 'all') params.set('category', category);
  if (mood !== 'all') params.set('mood', mood);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function mapCatalogCardToExploreCard(
  item: CatalogCard,
  categoriesById: Map<string, Pick<Category, 'id' | 'slug' | 'name'>>,
  activeCategoryObj: Pick<Category, 'id' | 'slug' | 'name'> | null
): ExploreCardQuiz {
  const resolvedCategory =
    (item.categoryId ? (categoriesById.get(item.categoryId) ?? null) : null) ?? activeCategoryObj;
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    cover_image_url: item.coverImageUrl,
    quiz_type: item.quizType,
    estimated_minutes: item.estimatedMinutes,
    plays_count: item.plays,
    likes_count: 0,
    is_featured: false,
    tags: [],
    category: resolvedCategory
      ? { id: resolvedCategory.id, slug: resolvedCategory.slug, name: resolvedCategory.name }
      : null,
  };
}

interface ExploreCatalogPageProps {
  locale: Locale;
  quizzes: ExploreCardQuiz[];
  categories: Category[];
  totalQuizzes?: number;
  isFallback?: boolean;
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
    clearFilters?: string;
    loadingMore?: string;
    loadError?: string;
    retry?: string;
    fallbackNoticeTitle?: string;
    fallbackNoticeBody?: string;
  };
}

export function ExploreEditorialPage({
  locale,
  quizzes,
  categories,
  totalQuizzes,
  isFallback,
  copy,
}: ExploreCatalogPageProps) {
  const [query, setQuery] = React.useState('');
  const [activeMood, setActiveMood] = React.useState<MoodId>('all');
  const [activeCategory, setActiveCategory] = React.useState('all');
  const [showAll, setShowAll] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState('');

  // Estado remoto para paginación y búsqueda contra GET /api/quizzes cuando el
  // servidor envió solo el lote inicial (<= 24 tarjetas).
  const [remoteExtraQuizzes, setRemoteExtraQuizzes] = React.useState<ExploreCardQuiz[]>([]);
  const [remoteFilteredQuizzes, setRemoteFilteredQuizzes] = React.useState<
    ExploreCardQuiz[] | null
  >(null);
  const [remoteTotal, setRemoteTotal] = React.useState<number | null>(null);
  const [remotePage, setRemotePage] = React.useState(1);
  const [remoteHasMore, setRemoteHasMore] = React.useState(false);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState(false);

  const restRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const initialUrlRef = React.useRef<string | null>(null);
  const historyTouchedRef = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const isDegraded =
    Boolean(isFallback) ||
    (quizzes.length > 0 && quizzes.every((quiz) => quiz.id.startsWith('launch-')));
  const hasRemoteCatalog =
    !isDegraded && typeof totalQuizzes === 'number' && totalQuizzes > quizzes.length;

  const moods = MOODS[locale];
  const localizedQuizzes = React.useMemo(
    () => quizzes.map((quiz) => ({ ...quiz, category: localizeCategory(quiz.category, locale) })),
    [locale, quizzes]
  );
  const localizedCategories = React.useMemo(
    () => categories.map((category) => localizeCategory(category, locale)).filter(Boolean),
    [categories, locale]
  );
  const categoriesById = React.useMemo(
    () =>
      new Map(
        localizedCategories.map((cat) => [
          cat!.id,
          { id: cat!.id, slug: cat!.slug, name: cat!.name },
        ])
      ),
    [localizedCategories]
  );
  const activeCategoryObj = React.useMemo(() => {
    if (activeCategory === 'all') return null;
    const found = localizedCategories.find((cat) => cat!.slug === activeCategory);
    return found ? { id: found.id, slug: found.slug, name: found.name } : null;
  }, [activeCategory, localizedCategories]);

  // Sincronización con URL (?q=, ?category=, ?mood=) y navegación atrás/adelante.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    initialUrlRef.current = `${window.location.pathname}${window.location.search}`;

    const applyLocation = () => {
      const parsed = parseUrlState(window.location.search);
      setQuery(parsed.q);
      setActiveCategory(parsed.category);
      setActiveMood(parsed.mood);
      setShowAll(false);
      setAnnouncement('');
    };

    if (window.location.search) {
      applyLocation();
    }

    const onPopState = () => {
      applyLocation();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      abortRef.current?.abort();
      if (
        historyTouchedRef.current &&
        initialUrlRef.current !== null &&
        typeof navigator !== 'undefined' &&
        navigator.userAgent.includes('jsdom')
      ) {
        window.history.replaceState(null, '', initialUrlRef.current);
      }
    };
  }, []);

  const syncUrl = React.useCallback(
    (nextQ: string, nextCategory: string, nextMood: MoodId, mode: 'push' | 'replace') => {
      if (typeof window === 'undefined') return;
      const nextSearch = buildFilterSearch(nextQ, nextCategory, nextMood);
      const nextUrl = `${window.location.pathname}${nextSearch}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl === currentUrl) return;
      historyTouchedRef.current = true;
      if (mode === 'push') {
        window.history.pushState(null, '', nextUrl);
      } else {
        window.history.replaceState(null, '', nextUrl);
      }
    },
    []
  );

  // El texto normalizado se precalcula una vez por quiz (no en cada
  // pulsación) y la consulta espera a `useDeferredValue`: escribir en el
  // buscador no bloquea el input mientras se refiltra el catálogo.
  const deferredQuery = React.useDeferredValue(query);
  const searchIndex = React.useMemo(
    () => localizedQuizzes.map((quiz) => ({ quiz, text: searchIndexText(quiz) })),
    [localizedQuizzes]
  );

  const localFilteredQuizzes = React.useMemo(() => {
    let entries = searchIndex;
    if (deferredQuery.trim()) {
      const normalizedQuery = foldSearchText(deferredQuery.trim());
      if (normalizedQuery) {
        entries = entries.filter((entry) => matchesSearchIndex(entry.text, normalizedQuery));
      }
    }
    let next = entries.map((entry) => entry.quiz);

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
  }, [activeCategory, activeMood, searchIndex, deferredQuery]);

  const trimmedDeferredQuery = deferredQuery.trim();
  const normalizedDeferredQuery = foldSearchText(trimmedDeferredQuery);
  const hasEffectiveQuery = normalizedDeferredQuery.length >= 2;
  const hasActiveRemoteFilter =
    hasRemoteCatalog && (hasEffectiveQuery || activeCategory !== 'all' || activeMood !== 'all');

  const fetchRemotePage = React.useCallback(
    async (targetPage: number, append: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRemoteLoading(true);
      setRemoteError(false);

      try {
        const params = new URLSearchParams({
          locale,
          page: String(targetPage),
          limit: String(REMOTE_PAGE_LIMIT),
        });
        if (activeCategory !== 'all') {
          params.set('category', activeCategory);
        }
        if (activeMood !== 'all') {
          params.set('mood', activeMood);
          if (activeMood === 'trivia' || activeMood === 'personality') {
            params.set('type', activeMood);
          }
        }
        if (hasEffectiveQuery) {
          params.set('q', trimmedDeferredQuery.slice(0, REMOTE_QUERY_MAX_LEN));
        }

        const res = await fetch(`/api/quizzes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`quizzes_${res.status}`);
        }
        const data = (await res.json()) as CatalogPage;
        if (controller.signal.aborted) return;

        const mapped = (data.items ?? []).map((item) =>
          mapCatalogCardToExploreCard(item, categoriesById, activeCategoryObj)
        );

        setRemotePage(data.page ?? targetPage);
        setRemoteTotal(typeof data.total === 'number' ? data.total : mapped.length);
        setRemoteHasMore(Boolean(data.hasMore));

        if (hasActiveRemoteFilter) {
          setRemoteFilteredQuizzes((prev) => {
            if (!append || !prev) return mapped;
            const seen = new Set(prev.map((q) => q.id));
            return [...prev, ...mapped.filter((q) => !seen.has(q.id))];
          });
          if (append) {
            setShowAll(true);
          }
        } else {
          const initialIds = new Set(localizedQuizzes.map((q) => q.id));
          setRemoteExtraQuizzes((prev) => {
            const base = append ? prev : [];
            const seen = new Set([...initialIds, ...base.map((q) => q.id)]);
            return [...base, ...mapped.filter((q) => !seen.has(q.id))];
          });
          setShowAll(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setRemoteError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRemoteLoading(false);
        }
      }
    },
    [
      activeCategory,
      activeCategoryObj,
      activeMood,
      categoriesById,
      hasActiveRemoteFilter,
      hasEffectiveQuery,
      locale,
      localizedQuizzes,
      trimmedDeferredQuery,
    ]
  );

  // Cuando hay un filtro o búsqueda activa sobre el catálogo paginado, pide
  // la primera página a `GET /api/quizzes`.
  React.useEffect(() => {
    if (!hasRemoteCatalog || !hasActiveRemoteFilter) {
      abortRef.current?.abort();
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchRemotePage(1, false);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [fetchRemotePage, hasActiveRemoteFilter, hasRemoteCatalog]);

  const effectiveQuizzes = React.useMemo(() => {
    if (!hasRemoteCatalog) {
      return localFilteredQuizzes;
    }
    if (hasActiveRemoteFilter) {
      return remoteFilteredQuizzes ?? localFilteredQuizzes;
    }
    return [...localFilteredQuizzes, ...remoteExtraQuizzes];
  }, [
    hasActiveRemoteFilter,
    hasRemoteCatalog,
    localFilteredQuizzes,
    remoteExtraQuizzes,
    remoteFilteredQuizzes,
  ]);

  const {
    lead: featuredLead,
    pulse: pulseQuiz,
    lanes: laneQuizzes,
    grid: gridQuizzes,
    rest: restQuizzes,
  } = React.useMemo(
    () => explorerSelection(effectiveQuizzes, { preferEditorial: activeMood !== 'popular' }),
    [effectiveQuizzes, activeMood]
  );

  // Cuando el lote inicial de SSR es de 24 tarjetas (1 lead + 1 pulse + 4 lanes
  // + 18 grid = 24), `restQuizzes` de explorerSelection empieza tras las 36, así
  // que en modo remoto las tarjetas extras cargadas bajo demanda van a `rest`.
  const displayGridQuizzes = React.useMemo(() => {
    if (!hasRemoteCatalog || hasActiveRemoteFilter) {
      return gridQuizzes;
    }
    return gridQuizzes.slice(0, Math.max(0, localizedQuizzes.length - 6));
  }, [gridQuizzes, hasActiveRemoteFilter, hasRemoteCatalog, localizedQuizzes.length]);

  const displayRestQuizzes = React.useMemo(() => {
    if (!hasRemoteCatalog || hasActiveRemoteFilter) {
      return restQuizzes;
    }
    const initialGridCount = Math.max(0, localizedQuizzes.length - 6);
    return [...gridQuizzes.slice(initialGridCount), ...restQuizzes];
  }, [gridQuizzes, hasActiveRemoteFilter, hasRemoteCatalog, localizedQuizzes.length, restQuizzes]);

  const units = getExploreCopy(locale);

  const totalMatchingCount = React.useMemo(() => {
    if (!hasRemoteCatalog) {
      return effectiveQuizzes.length;
    }
    if (hasActiveRemoteFilter) {
      return remoteTotal ?? effectiveQuizzes.length;
    }
    return totalQuizzes ?? effectiveQuizzes.length;
  }, [effectiveQuizzes.length, hasActiveRemoteFilter, hasRemoteCatalog, remoteTotal, totalQuizzes]);

  const baseVisibleCount =
    (featuredLead ? 1 : 0) + (pulseQuiz ? 1 : 0) + laneQuizzes.length + displayGridQuizzes.length;

  const visibleCount = baseVisibleCount + (showAll ? displayRestQuizzes.length : 0);

  const remainingToLoadCount = hasRemoteCatalog
    ? Math.max(0, totalMatchingCount - visibleCount)
    : displayRestQuizzes.length;

  const resetExpansion = () => {
    abortRef.current?.abort();
    setShowAll(false);
    setAnnouncement('');
    setRemoteFilteredQuizzes(null);
    setRemoteExtraQuizzes([]);
    setRemoteTotal(totalQuizzes ?? null);
    setRemoteHasMore((totalQuizzes ?? 0) > localizedQuizzes.length);
    setRemotePage(1);
    setRemoteError(false);
    setRemoteLoading(false);
  };

  const clearAllFilters = () => {
    setQuery('');
    setActiveMood('all');
    setActiveCategory('all');
    resetExpansion();
    syncUrl('', 'all', 'all', 'push');
    searchInputRef.current?.focus();
  };

  const toggleShowAll = () => {
    if (hasRemoteCatalog) {
      if (remoteLoading) return;
      // Si aún hay páginas remotas por traer, pide la siguiente página a /api/quizzes.
      const nextPage = hasActiveRemoteFilter || remoteExtraQuizzes.length > 0 ? remotePage + 1 : 2;
      if (!showAll || remoteHasMore || totalMatchingCount > effectiveQuizzes.length) {
        void fetchRemotePage(nextPage, true);
        return;
      }
    }
    const next = !showAll;
    setShowAll(next);
    setAnnouncement(
      units.showingCount(next ? effectiveQuizzes.length : baseVisibleCount, totalMatchingCount)
    );
  };

  // Al expandir, el foco va a la primera tarjeta nueva: el botón queda antes
  // de una lista larga y el usuario de teclado no debería recorrerla entera.
  React.useEffect(() => {
    if (showAll && displayRestQuizzes.length > 0) {
      restRef.current?.querySelector<HTMLElement>('a')?.focus();
    }
  }, [showAll, displayRestQuizzes.length]);

  const hasAnyFilter = query.trim().length > 0 || activeCategory !== 'all' || activeMood !== 'all';

  const clearFiltersLabel =
    copy.clearFilters ?? (locale === 'es' ? 'Limpiar filtros' : 'Clear filters');
  const loadingMoreLabel =
    copy.loadingMore ?? (locale === 'es' ? 'Cargando quizzes…' : 'Loading quizzes…');
  const loadErrorLabel =
    copy.loadError ??
    (locale === 'es'
      ? 'No pudimos cargar el catálogo remoto. Inténtalo de nuevo.'
      : 'We could not load the remote catalog. Please try again.');
  const retryLabel = copy.retry ?? (locale === 'es' ? 'Reintentar' : 'Try again');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-8 pb-20">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-text-primary text-[2rem] leading-tight font-semibold tracking-tight md:text-5xl">
          {copy.title}
        </h1>
        <p className="text-text-secondary max-w-2xl text-base">{copy.subtitle}</p>
      </header>

      {isDegraded ? (
        <aside
          role="note"
          aria-label={
            copy.fallbackNoticeTitle ??
            (locale === 'es'
              ? 'Catálogo en modo de respaldo (solo lectura)'
              : 'Catalog in read-only fallback mode')
          }
          className="border-border-subtle bg-bg-secondary text-text-secondary rounded border p-4 text-sm"
        >
          <p className="text-text-primary font-semibold">
            {copy.fallbackNoticeTitle ??
              (locale === 'es'
                ? 'Catálogo en modo de respaldo (solo lectura)'
                : 'Catalog in read-only fallback mode')}
          </p>
          <p className="mt-1">
            {copy.fallbackNoticeBody ??
              (locale === 'es'
                ? 'Mostramos la selección base mientras se recupera la conexión. Las partidas que requieren guardar puntaje o ranking volverán a estar disponibles en breve.'
                : 'Showing the base selection while the connection recovers. Games that require saving scores or rankings will be available again shortly.')}
          </p>
        </aside>
      ) : null}

      <section className="space-y-4">
        <label className="block">
          <span className="sr-only">{copy.searchLabel ?? units.search}</span>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              resetExpansion();
              syncUrl(nextValue, activeCategory, activeMood, 'replace');
            }}
            placeholder={copy.searchPlaceholder}
            className={cn(
              'border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary h-12 w-full rounded-full border px-5 text-sm transition-colors',
              FOCUS_RING_CLASS
            )}
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
                syncUrl(query, activeCategory, mood.id, 'push');
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
                syncUrl(query, 'all', activeMood, 'push');
              }}
            />
            {localizedCategories.map((category) => (
              <FilterChip
                key={category!.id}
                active={activeCategory === category!.slug}
                label={category!.icon ? `${category!.icon} ${category!.name}` : category!.name}
                onClick={() => {
                  setActiveCategory(category!.slug);
                  resetExpansion();
                  syncUrl(query, category!.slug, activeMood, 'push');
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-text-secondary text-sm">
            {totalMatchingCount} {copy.quizzesAfterFilters ?? units.quizzesAfterFilters}
          </p>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className={cn(
                'border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-primary inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
                FOCUS_RING_CLASS
              )}
            >
              {clearFiltersLabel}
            </button>
          ) : null}
        </div>

        {remoteLoading ? (
          <p aria-live="polite" className="text-text-secondary text-sm">
            {loadingMoreLabel}
          </p>
        ) : null}

        {remoteError ? (
          <div
            role="alert"
            className="border-border-subtle bg-bg-secondary flex flex-wrap items-center justify-between gap-3 rounded border p-4 text-sm"
          >
            <span className="text-text-primary">{loadErrorLabel}</span>
            <button
              type="button"
              onClick={() =>
                void fetchRemotePage(
                  hasActiveRemoteFilter && !remoteFilteredQuizzes ? 1 : remotePage + 1,
                  Boolean(remoteFilteredQuizzes || remoteExtraQuizzes.length > 0)
                )
              }
              className={cn(
                'bg-accent-primary text-bg-primary inline-flex min-h-10 items-center rounded-full px-4 py-2 text-xs font-semibold',
                FOCUS_RING_CLASS
              )}
            >
              {retryLabel}
            </button>
          </div>
        ) : null}
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
                      className={cn('text-accent-primary', FOCUS_RING_CLASS)}
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
                      className={cn(
                        'border-border-subtle text-text-secondary hover:text-text-primary bg-bg-primary inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
                        FOCUS_RING_CLASS
                      )}
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

          {displayGridQuizzes.length > 0 || displayRestQuizzes.length > 0 ? (
            <section className="space-y-5">
              <div className="space-y-2">
                <p className="eyebrow">{units.editorialGrid}</p>
                <h2 className="text-4xl">{units.fullCatalog}</h2>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                {displayGridQuizzes.map((quiz, index) => (
                  <div
                    key={quiz.id}
                    className="qv-l1-explore-card"
                    style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
                  >
                    <EditorialQuizCard quiz={quiz} locale={locale} index={index} />
                  </div>
                ))}
              </div>
              {(!hasRemoteCatalog && displayRestQuizzes.length > 0) ||
              (hasRemoteCatalog && (remainingToLoadCount > 0 || displayRestQuizzes.length > 0)) ? (
                <>
                  <button
                    type="button"
                    aria-expanded={showAll}
                    aria-controls="explore-grid-rest"
                    disabled={remoteLoading}
                    onClick={toggleShowAll}
                    className={cn('arcade-button arcade-button-lime arcade-more', FOCUS_RING_CLASS)}
                  >
                    {remoteLoading
                      ? loadingMoreLabel
                      : hasRemoteCatalog
                        ? remainingToLoadCount > 0
                          ? units.showMore(remainingToLoadCount)
                          : showAll
                            ? units.showLess
                            : units.showMore(displayRestQuizzes.length)
                        : showAll
                          ? units.showLess
                          : units.showMore(displayRestQuizzes.length)}
                  </button>
                  <p id="explore-show-more-announcement" aria-live="polite" className="sr-only">
                    {announcement}
                  </p>
                </>
              ) : null}
              {showAll && displayRestQuizzes.length > 0 ? (
                <div
                  id="explore-grid-rest"
                  ref={restRef}
                  className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3"
                >
                  {displayRestQuizzes.map((quiz, index) => (
                    <div
                      key={quiz.id}
                      className="qv-l1-explore-card"
                      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
                    >
                      <EditorialQuizCard
                        quiz={quiz}
                        locale={locale}
                        index={displayGridQuizzes.length + index}
                      />
                    </div>
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
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className={cn(
                'bg-accent-primary text-bg-primary mt-6 inline-flex min-h-11 items-center rounded-full px-6 py-2.5 text-sm font-semibold transition-colors',
                FOCUS_RING_CLASS
              )}
            >
              {clearFiltersLabel}
            </button>
          ) : null}
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
        FOCUS_RING_CLASS,
        active
          ? 'border-accent-primary bg-accent-primary text-bg-primary'
          : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}
