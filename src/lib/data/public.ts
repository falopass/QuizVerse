import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { CATALOG_REVALIDATE_SECONDS, CATALOG_TAGS } from '@/lib/data/cache-tags';
import { LAUNCH_CATEGORIES, LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import {
  normalizeCategory,
  normalizeQuiz,
  normalizeProfile,
  normalizeGameSession,
  normalizeAchievement,
  type CategoryRow,
  type QuizRow,
  type ProfileRow,
  type AchievementRow,
} from '@/lib/data/normalizers';
import type {
  Achievement,
  Category,
  ExploreCardQuiz,
  Profile,
  ProfileBadge,
  Quiz,
  QuizCardViewModel,
  QuizSessionResult,
} from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';
import {
  CATEGORY_PAGE_SIZE,
  isLastPage,
  pageRanges,
  QUIZ_MAX_ROWS,
  QUIZ_PAGE_SIZE,
} from './quiz-pagination';
import { getCategoryCounts } from '@/lib/data/category-counts';
import { fetchSessionByShareToken } from '@/lib/data/game-session';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { localizeQuizList } from '@/lib/i18n/catalog';
import { toExploreCard } from '@/lib/quiz/explore-card';
import { versionedStockCoverUrl } from '@/lib/data/stock-cover-manifest';

async function fetchPublicCategoriesFromDb(): Promise<Category[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error || !data) {
    throw error ?? new Error('Could not fetch categories');
  }
  return data.map(normalizeCategory);
}

const fetchPublicCategoriesCached = unstable_cache(
  fetchPublicCategoriesFromDb,
  ['public-categories'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAGS.categories] }
);

async function fetchPublishedQuizzesFromDb(limit = 40, locale?: Locale): Promise<Quiz[]> {
  const supabase = createPublicClient();
  const target = Math.min(Math.max(Math.trunc(limit), 0), QUIZ_MAX_ROWS);

  const publishedQuery = () => {
    let quizQuery = supabase.from('quizzes').select('*').eq('status', 'published');
    if (locale) {
      quizQuery = quizQuery.eq('language', locale);
    }
    return quizQuery;
  };

  const [quizRows, { data: categories, error: categoryError }] = await Promise.all([
    (async (): Promise<QuizRow[]> => {
      if (target <= QUIZ_PAGE_SIZE) {
        if (target === 0) return [];
        const { data, error } = await publishedQuery()
          .order('plays_count', { ascending: false })
          .order('id', { ascending: true })
          .limit(target);
        if (error || !data) {
          throw error ?? new Error('Could not fetch quizzes');
        }
        return data as QuizRow[];
      }
      // plays_count puede cambiar entre páginas y mover una fila al otro lado
      // del offset; por eso el scan ordena por id (inmutable) y reordena abajo.
      const rows: QuizRow[] = [];
      for (const { from, to } of pageRanges(QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS)) {
        const { data, error } = await publishedQuery()
          .order('id', { ascending: true })
          .range(from, to);
        if (error || !data) {
          throw error ?? new Error('Could not fetch quizzes');
        }
        rows.push(...(data as QuizRow[]));
        if (isLastPage(data.length, to - from + 1)) {
          break;
        }
      }
      rows.sort((a, b) => b.plays_count - a.plays_count || (a.id < b.id ? -1 : 1));
      return rows.slice(0, target);
    })(),
    supabase.from('categories').select('*').order('sort_order'),
  ]);

  if (categoryError || !categories) {
    throw categoryError ?? new Error('Could not fetch categories');
  }

  const categoryRows = categories as CategoryRow[];
  const categoryMap = new Map(categoryRows.map((item) => [item.id, normalizeCategory(item)]));

  return quizRows.map((quiz) => normalizeQuiz(quiz, categoryMap));
}

const fetchPublishedQuizzesCached = unstable_cache(
  fetchPublishedQuizzesFromDb,
  ['published-quizzes'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAGS.quizzes] }
);

// Tarjetas y búsqueda de /quiz; published_at conserva el orden de /llms.txt.
// Se proyecta antes de cachear: el catálogo completo con preguntas supera 2 MB.
export const EXPLORE_CARD_COLUMNS =
  'id, slug, title, description, category_id, quiz_type, cover_image_url, estimated_minutes, plays_count, likes_count, tags, is_featured, published_at';

type ExploreCardRow = Omit<ExploreCardQuiz, 'category'> &
  Pick<QuizRow, 'category_id' | 'published_at'>;

async function fetchExploreQuizzesFromDb(locale?: Locale) {
  const supabase = createPublicClient();
  const [rows, categories] = await Promise.all([
    (async () => {
      const rows: ExploreCardRow[] = [];
      for (const { from, to } of pageRanges(QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS)) {
        let query = supabase.from('quizzes').select(EXPLORE_CARD_COLUMNS).eq('status', 'published');
        if (locale) query = query.eq('language', locale);
        const { data, error } = await query.order('id', { ascending: true }).range(from, to);
        if (error || !data) throw error ?? new Error('Could not fetch explore quizzes');
        rows.push(...(data as unknown as ExploreCardRow[]));
        if (isLastPage(data.length, to - from + 1)) break;
      }
      return rows;
    })(),
    fetchPublicCategoriesCached(),
  ]);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  rows.sort((a, b) => b.plays_count - a.plays_count || (a.id < b.id ? -1 : 1));
  return rows.map((row) => ({
    ...toExploreCard({
      ...row,
      cover_image_url: versionedStockCoverUrl(row.cover_image_url),
      category: row.category_id ? (categoryMap.get(row.category_id) ?? null) : null,
    }),
    published_at: row.published_at,
  }));
}

const fetchExploreQuizzesCached = unstable_cache(fetchExploreQuizzesFromDb, ['explore-quizzes'], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CATALOG_TAGS.quizzes, CATALOG_TAGS.categories],
});

async function fetchFeaturedQuizzesFromDb(limit = 4, locale?: Locale): Promise<Quiz[]> {
  const supabase = createPublicClient();
  const target = Math.min(Math.max(Math.trunc(limit), 0), QUIZ_MAX_ROWS);

  let quizQuery = supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('is_featured', true);
  if (locale) {
    quizQuery = quizQuery.eq('language', locale);
  }

  const [quizRows, { data: categories, error: categoryError }] = await Promise.all([
    (async (): Promise<QuizRow[]> => {
      if (target === 0) return [];
      const { data, error } = await quizQuery
        .order('plays_count', { ascending: false })
        .order('id', { ascending: true })
        .limit(target);
      if (error || !data) {
        throw error ?? new Error('Could not fetch featured quizzes');
      }
      return data as QuizRow[];
    })(),
    supabase.from('categories').select('*').order('sort_order'),
  ]);

  if (categoryError || !categories) {
    throw categoryError ?? new Error('Could not fetch categories');
  }

  const categoryMap = new Map(
    (categories as CategoryRow[]).map((item) => [item.id, normalizeCategory(item)])
  );
  return quizRows.map((quiz) => normalizeQuiz(quiz, categoryMap));
}

const fetchFeaturedQuizzesCached = unstable_cache(
  fetchFeaturedQuizzesFromDb,
  ['featured-quizzes'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAGS.quizzes] }
);

async function fetchPublishedQuizTotalsFromDb(locale?: Locale): Promise<{
  totalQuizzes: number;
  totalPlays: number;
}> {
  const supabase = createPublicClient();
  let query = supabase
    .from('quizzes')
    .select('plays_count', { count: 'exact' })
    .eq('status', 'published');

  if (locale) {
    query = query.eq('language', locale);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const totalPlays = ((data as Array<{ plays_count: number }> | null) ?? []).reduce(
    (total, quiz) => total + quiz.plays_count,
    0
  );

  return {
    totalQuizzes: count ?? 0,
    totalPlays,
  };
}

const fetchPublishedQuizTotalsCached = unstable_cache(
  fetchPublishedQuizTotalsFromDb,
  ['published-quiz-totals'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAGS.quizzes] }
);

async function fetchQuizBySlugFromDb(slug: string, locale?: Locale): Promise<Quiz | null> {
  const supabase = createPublicClient();
  let query = supabase.from('quizzes').select('*').eq('slug', slug).eq('status', 'published');

  if (locale) {
    query = query.eq('language', locale);
  }

  const { data: quiz, error } = await query.single();

  if (error) {
    // PGRST116 = 0 filas: el slug no existe publicado, y ese null sí se cachea.
    if (error.code === 'PGRST116') return null;
    // Un fallo de red no puede quedar cacheado como "no existe": serían 404
    // durante los 300 s de la entrada. Se lanza y `getQuizBySlug` cae al
    // catálogo de lanzamiento sin cachear el resultado.
    throw error;
  }
  if (!quiz) return null;

  const quizRow = quiz as QuizRow;
  // El creador se resuelve con el badge mínimo (sin is_admin ni contadores):
  // es lo único del perfil que puede acabar serializado hacia el cliente.
  // Si esa consulta falla la ficha sigue sin atribución — nunca la tumba.
  const creatorPromise: Promise<{ data: ProfileBadge | null }> = (async () => {
    if (!quizRow.creator_id) return { data: null };
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', quizRow.creator_id)
        .maybeSingle();
      return { data: (data as ProfileBadge | null) ?? null };
    } catch {
      return { data: null };
    }
  })();

  const [categoryResponse, creatorResponse] = await Promise.all([
    quizRow.category_id
      ? supabase.from('categories').select('*').eq('id', quizRow.category_id).single()
      : Promise.resolve({ data: null }),
    creatorPromise,
  ]);

  const categoryMap = new Map<string, Category>();
  const categoryRow = (categoryResponse as { data: CategoryRow | null }).data;

  if (categoryRow) {
    categoryMap.set(categoryRow.id, normalizeCategory(categoryRow));
  }

  return normalizeQuiz(quizRow, categoryMap, creatorResponse.data);
}

// El tag por slug se arma en cada llamada porque depende del argumento: así
// un like (o cualquier cambio de un solo quiz) invalida su ficha y no todo el
// catálogo.
function fetchQuizBySlugCached(slug: string, locale?: Locale): Promise<Quiz | null> {
  return unstable_cache(fetchQuizBySlugFromDb, ['quiz-by-slug', slug], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_TAGS.quizzes, CATALOG_TAGS.quiz(slug)],
  })(slug, locale);
}

export const getPublicCategories = cache(async (): Promise<Category[]> => {
  try {
    return await fetchPublicCategoriesCached();
  } catch {
    return LAUNCH_CATEGORIES;
  }
});

export const getPublishedQuizzes = cache(async (limit = 40, locale?: Locale): Promise<Quiz[]> => {
  try {
    return await fetchPublishedQuizzesCached(limit, locale);
  } catch {
    const launch = locale
      ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale)
      : LAUNCH_QUIZZES;
    return launch.slice(0, limit);
  }
});

export const getFeaturedQuizzes = cache(async (limit = 4, locale?: Locale): Promise<Quiz[]> => {
  try {
    return await fetchFeaturedQuizzesCached(limit, locale);
  } catch {
    return LAUNCH_QUIZZES.filter(
      (quiz) => quiz.is_featured && (!locale || quiz.language === locale)
    ).slice(0, limit);
  }
});

export const getQuizBySlug = cache(async (slug: string, locale?: Locale): Promise<Quiz | null> => {
  try {
    return await fetchQuizBySlugCached(slug, locale);
  } catch {
    const launch = LAUNCH_QUIZZES.filter((quiz) => quiz.slug === slug);
    return (locale ? launch.find((quiz) => quiz.language === locale) : launch[0]) ?? null;
  }
});

// Destino cuando un slug publicado se pide bajo el locale equivocado: el par
// traducido si existe en el idioma pedido y, si no, el mismo slug en el idioma
// donde sí está publicado. Null si el slug no existe en ninguno de los dos.
// `keepSameQuiz` es para enlaces con token (reto o resultado): esos tokens
// están atados al id del quiz original, así que solo se puede cambiar de
// idioma, no de quiz.
export const getQuizLocaleRedirect = cache(
  async (
    slug: string,
    locale: Locale,
    { keepSameQuiz = false }: { keepSameQuiz?: boolean } = {}
  ): Promise<{ locale: Locale; slug: string } | null> => {
    const other: Locale = locale === 'es' ? 'en' : 'es';
    const source = await getQuizBySlug(slug, other);
    if (!source) return null;
    if (keepSameQuiz) return { locale: other, slug: source.slug };
    const translated = getEquivalentQuizSlug(slug, locale);
    const counterpart = translated ? await getQuizBySlug(translated, locale) : null;
    return counterpart ? { locale, slug: counterpart.slug } : { locale: other, slug: source.slug };
  }
);

export const getPublishedQuizCount = cache(async (locale?: Locale): Promise<number> => {
  try {
    return (await fetchPublishedQuizTotalsCached(locale)).totalQuizzes;
  } catch {
    return locale
      ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale).length
      : LAUNCH_QUIZZES.length;
  }
});

function launchQuizzes(locale?: Locale): Quiz[] {
  return locale ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale) : LAUNCH_QUIZZES;
}

// Fallback de página, mismo patrón que la ficha de quiz: si el payload real
// falla entero, home y /quiz sirven el catálogo de lanzamiento con la misma
// forma en vez de propagar el error a la página de error.
export function getLaunchExplorePayload(locale?: Locale) {
  const quizzes = launchQuizzes(locale);
  const populated = new Set(quizzes.map((quiz) => quiz.category?.slug));
  return {
    quizzes,
    categories: LAUNCH_CATEGORIES.filter((item) => populated.has(item.slug)),
  };
}

export async function getExplorePayload(
  localeOrSearch?: Locale | string,
  searchOrCategory?: string,
  maybeCategorySlug?: string
) {
  const locale = localeOrSearch === 'en' || localeOrSearch === 'es' ? localeOrSearch : undefined;
  const search = locale ? searchOrCategory : localeOrSearch;
  const categorySlug = locale ? maybeCategorySlug : searchOrCategory;
  const [quizzes, categories] = await Promise.all([
    fetchExploreQuizzesCached(locale).catch(() => launchQuizzes(locale)),
    getPublicCategories(),
  ]);
  const normalizedSearch = search?.trim().toLowerCase() ?? '';

  const filtered = quizzes.filter((quiz) => {
    const matchesCategory = categorySlug ? quiz.category?.slug === categorySlug : true;
    const matchesSearch = normalizedSearch
      ? quiz.title.toLowerCase().includes(normalizedSearch) ||
        (quiz.description ?? '').toLowerCase().includes(normalizedSearch) ||
        quiz.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
      : true;

    return matchesCategory && matchesSearch;
  });

  const populated = new Set(quizzes.map((quiz) => quiz.category?.slug));
  return { quizzes: filtered, categories: categories.filter((item) => populated.has(item.slug)) };
}

function homeSections(
  quizzes: Quiz[],
  featuredRows: Quiz[],
  categories: Category[],
  totals: { totalQuizzes: number; totalPlays: number }
) {
  const trending = [...quizzes].sort((a, b) => b.plays_count - a.plays_count).slice(0, 6);
  const featured = featuredRows.filter((quiz) => quiz.is_featured).slice(0, 4);
  const quickPlays = [...quizzes]
    .sort((a, b) => a.estimated_minutes - b.estimated_minutes)
    .slice(0, 4);
  const freshlyPublished = [...quizzes]
    .sort(
      (a, b) =>
        new Date(b.published_at ?? b.created_at).getTime() -
        new Date(a.published_at ?? a.created_at).getTime()
    )
    .slice(0, 6);

  return {
    categories,
    trending,
    featured,
    quickPlays,
    freshlyPublished,
    totalQuizzes: totals.totalQuizzes,
    totalPlays: totals.totalPlays,
  };
}

export async function getHomePayload(locale?: Locale) {
  const [quizzes, featuredRows, categories, totals] = await Promise.all([
    getPublishedQuizzes(24, locale),
    getFeaturedQuizzes(4, locale),
    getPublicCategories(),
    (async () => {
      try {
        return await fetchPublishedQuizTotalsCached(locale);
      } catch {
        const launch = launchQuizzes(locale);

        return {
          totalQuizzes: launch.length,
          totalPlays: launch.reduce((total, quiz) => total + quiz.plays_count, 0),
        };
      }
    })(),
  ]);

  return homeSections(quizzes, featuredRows, categories, totals);
}

export function getLaunchHomePayload(locale?: Locale) {
  const quizzes = launchQuizzes(locale);
  return homeSections(
    quizzes,
    quizzes.filter((quiz) => quiz.is_featured),
    LAUNCH_CATEGORIES,
    {
      totalQuizzes: quizzes.length,
      totalPlays: quizzes.reduce((total, quiz) => total + quiz.plays_count, 0),
    }
  );
}

// Columnas de tarjeta: la grilla no lee preguntas, resultados ni métricas
// sociales, así que la consulta no las trae (antes era select('*')).
export const CATEGORY_CARD_COLUMNS =
  'id, slug, title, description, language, category_id, quiz_type, difficulty, cover_image_url, estimated_minutes, plays_count, likes_count, avg_score, tags, published_at, created_at, is_featured';

type CategoryCardRow = Pick<
  QuizRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'description'
  | 'language'
  | 'category_id'
  | 'quiz_type'
  | 'difficulty'
  | 'cover_image_url'
  | 'estimated_minutes'
  | 'plays_count'
  | 'likes_count'
  | 'avg_score'
  | 'tags'
  | 'published_at'
  | 'created_at'
  | 'is_featured'
>;

// normalizeQuiz espera una fila completa; la tarjeta solo necesita las
// columnas de CATEGORY_CARD_COLUMNS, así que el resto va con valores neutros.
function normalizeCategoryCard(row: CategoryCardRow, categories: Map<string, Category>): Quiz {
  return normalizeQuiz(
    {
      ...row,
      questions: [],
      results: null,
      shares_count: 0,
      question_count: 0,
      status: 'published',
      is_ai_generated: false,
      featured_at: null,
      creator_id: null,
      moderated_by: null,
      moderated_at: null,
      moderation_note: null,
      updated_at: row.created_at,
    } as QuizRow,
    categories
  );
}

function sortByPopularity(quizzes: Quiz[]): Quiz[] {
  return [...quizzes].sort((a, b) => b.plays_count - a.plays_count || (a.id < b.id ? -1 : 1));
}

interface CategoryPageRows {
  rows: CategoryCardRow[];
  total: number;
}

async function fetchCategoryPageFromDb(
  slug: string,
  categoryId: string | null,
  locale: Locale | undefined,
  page: number
): Promise<CategoryPageRows> {
  const supabase = createPublicClient();
  const isType = slug === 'personality' || slug === 'trivia';
  const from = (page - 1) * CATEGORY_PAGE_SIZE;
  const to = from + CATEGORY_PAGE_SIZE - 1;
  let query = supabase
    .from('quizzes')
    .select(CATEGORY_CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'published');
  query = isType ? query.eq('quiz_type', slug) : query.eq('category_id', categoryId!);
  if (locale) query = query.eq('language', locale);
  // `plays_count` cambia entre visitas; el id desempata para que una fila no
  // salte de una página a otra.
  const { data, error, count } = await query
    .order('plays_count', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to);
  if (error || !data) throw error ?? new Error('Could not fetch category quizzes');
  return {
    rows: data as unknown as CategoryCardRow[],
    total: count ?? from + data.length,
  };
}

const fetchCategoryPageCached = unstable_cache(fetchCategoryPageFromDb, ['category-page'], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CATALOG_TAGS.quizzes],
});

export const getCategoryPayload = cache(async (slug: string, locale?: Locale, page = 1) => {
  const categories = await getPublicCategories();
  const category = categories.find((item) => item.slug === slug) ?? null;
  const isType = slug === 'personality' || slug === 'trivia';
  if (!category && !isType) {
    return null;
  }
  const safePage = Number.isSafeInteger(page) && page >= 1 ? page : 1;
  const from = (safePage - 1) * CATEGORY_PAGE_SIZE;
  const to = from + CATEGORY_PAGE_SIZE - 1;
  let quizzes: Quiz[];
  let totalQuizzes: number;
  let counts: Map<string, number>;
  try {
    // La página y los conteos de los chips no dependen entre sí: en paralelo.
    const [{ rows, total }, fetchedCounts] = await Promise.all([
      fetchCategoryPageCached(slug, category?.id ?? null, locale, safePage),
      locale ? getCategoryCounts(locale) : Promise.resolve(new Map<string, number>()),
    ]);
    counts = fetchedCounts;
    totalQuizzes = total;
    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    quizzes = rows.map((row) => normalizeCategoryCard(row, categoryMap));
  } catch {
    const launch = sortByPopularity(
      LAUNCH_QUIZZES.filter(
        (quiz) =>
          (isType ? quiz.quiz_type === slug : quiz.category?.slug === slug) &&
          (!locale || quiz.language === locale)
      )
    );
    totalQuizzes = launch.length;
    quizzes = launch.slice(from, to + 1);
    counts = new Map();
  }
  // Las categorías pobladas salen de un conteo ligero por slug. Si la consulta
  // falla (mapa vacío) se cae al conjunto de antes — las del catálogo de
  // lanzamiento más las de los quizzes ya cargados — para no enlazar
  // categorías que 404ean.
  const populated =
    counts.size > 0
      ? new Set(counts.keys())
      : new Set(
          [...quizzes, ...LAUNCH_QUIZZES.filter((quiz) => !locale || quiz.language === locale)]
            .map((quiz) => quiz.category?.slug)
            .filter((slug): slug is string => Boolean(slug))
        );
  return {
    category: category ?? {
      id: slug,
      slug,
      name: slug,
      description: null,
      icon: null,
      color: null,
      gradient_from: null,
      gradient_to: null,
      quiz_count: totalQuizzes,
      sort_order: 0,
    },
    categories: categories.filter((item) => populated.has(item.slug)),
    quizzes,
    totalQuizzes,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(totalQuizzes / CATEGORY_PAGE_SIZE)),
  };
});

async function fetchHubQuizProbe(
  slug: string,
  categoryId: string | null,
  locale?: Locale
): Promise<boolean> {
  const supabase = createPublicClient();
  const isType = slug === 'personality' || slug === 'trivia';
  let query = supabase.from('quizzes').select('id').eq('status', 'published');
  query = isType ? query.eq('quiz_type', slug) : query.eq('category_id', categoryId!);
  if (locale) query = query.eq('language', locale);
  const { data, error } = await query.limit(1);
  if (error || !data) throw error ?? new Error('Could not check category quizzes');
  return data.length > 0;
}

const fetchHubQuizProbeCached = unstable_cache(fetchHubQuizProbe, ['hub-quiz-probe'], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CATALOG_TAGS.quizzes],
});

// Sonda ligera compartida: replica la condición de notFound() de
// getCategoryPayload (los hubs de tipo se filtran por quiz_type, sin fila en
// categories) y devuelve null cuando la consulta falla, para que cada caller
// decida su fallback.
async function probeHubQuizzes(slug: string, locale?: Locale): Promise<boolean | null> {
  const category = (await getPublicCategories()).find((item) => item.slug === slug) ?? null;
  const isType = slug === 'personality' || slug === 'trivia';
  if (!category && !isType) return false;
  try {
    return await fetchHubQuizProbeCached(slug, category?.id ?? null, locale);
  } catch {
    return null;
  }
}

// Comprobación barata para /api/quiz/locale: mira si el hub (categoría o tipo
// de quiz) tiene ≥1 quiz publicado en el idioma sin traer questions/results
// ni recorrer páginas. Si la sonda falla cae al catálogo de lanzamiento, que
// es lo mismo que la página de categoría renderiza en ese caso.
export async function categoryHasQuizzes(slug: string, locale?: Locale): Promise<boolean> {
  const found = await probeHubQuizzes(slug, locale);
  if (found !== null) return found;
  const isType = slug === 'personality' || slug === 'trivia';
  return LAUNCH_QUIZZES.some(
    (quiz) =>
      (isType ? quiz.quiz_type === slug : quiz.category?.slug === slug) &&
      (!locale || quiz.language === locale)
  );
}

// Versión estricta para el hreflang de /category: la página hermana hace
// notFound() si su propio fetch devuelve 0 filas, así que una sonda caída no
// puede anunciar una traducción apoyándose en el catálogo de lanzamiento.
export async function translatedHubExists(slug: string, locale: Locale): Promise<boolean> {
  return (await probeHubQuizzes(slug, locale)) === true;
}

async function fetchHubQuizTotal(
  slug: string,
  categoryId: string | null,
  locale: Locale
): Promise<number> {
  const supabase = createPublicClient();
  const isType = slug === 'personality' || slug === 'trivia';
  let query = supabase
    .from('quizzes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  query = isType ? query.eq('quiz_type', slug) : query.eq('category_id', categoryId!);
  if (locale) query = query.eq('language', locale);
  const { count, error } = await query;
  if (error || count === null) throw error ?? new Error('Could not count hub quizzes');
  return count;
}

const fetchHubQuizTotalCached = unstable_cache(fetchHubQuizTotal, ['hub-quiz-total'], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CATALOG_TAGS.quizzes],
});

// Total publicado por hub e idioma, sin traer filas (HEAD + count). Devuelve
// null si la sonda falla para que el caller no anuncie una página dudosa.
async function probeHubQuizTotal(slug: string, locale: Locale): Promise<number | null> {
  const category = (await getPublicCategories()).find((item) => item.slug === slug) ?? null;
  const isType = slug === 'personality' || slug === 'trivia';
  if (!category && !isType) return 0;
  try {
    return await fetchHubQuizTotalCached(slug, category?.id ?? null, locale);
  } catch {
    return null;
  }
}

// La página `?page=N` de la hermana solo existe si ese idioma tiene al menos
// (N-1)*CATEGORY_PAGE_SIZE + 1 quizzes publicados: si no, el hreflang apuntaría
// a un 404. La página 1 sigue usando translatedHubExists.
export async function translatedHubPageExists(
  slug: string,
  locale: Locale,
  page: number
): Promise<boolean> {
  const total = await probeHubQuizTotal(slug, locale);
  return total !== null && total > (page - 1) * CATEGORY_PAGE_SIZE;
}

async function fetchCategoryQuizTypes(
  slug: string,
  categoryId: string | null,
  locale: Locale
): Promise<Array<Quiz['quiz_type']>> {
  const supabase = createPublicClient();
  const isType = slug === 'personality' || slug === 'trivia';
  let query = supabase.from('quizzes').select('quiz_type').eq('status', 'published');
  query = isType ? query.eq('quiz_type', slug) : query.eq('category_id', categoryId!);
  if (locale) query = query.eq('language', locale);
  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Could not fetch category quiz types');
  return [
    ...new Set((data as Array<{ quiz_type: Quiz['quiz_type'] }>).map((row) => row.quiz_type)),
  ];
}

const fetchCategoryQuizTypesCached = unstable_cache(
  fetchCategoryQuizTypes,
  ['category-quiz-types'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAGS.quizzes] }
);

// Tipos de quiz de todo el hub, para la tarjeta social: la página 1 sola no
// representa los tipos de las páginas siguientes. Es una consulta ligera de
// una columna y la OG se cachea en el edge.
export async function getCategoryQuizTypes(
  slug: string,
  locale: Locale
): Promise<Array<Quiz['quiz_type']>> {
  const category = (await getPublicCategories()).find((item) => item.slug === slug) ?? null;
  const isType = slug === 'personality' || slug === 'trivia';
  if (!category && !isType) return [];
  try {
    return await fetchCategoryQuizTypesCached(slug, category?.id ?? null, locale);
  } catch {
    return [];
  }
}

export interface HomeCardGroups {
  trending: QuizCardViewModel[];
  featured: QuizCardViewModel[];
  quickPlays: QuizCardViewModel[];
  freshlyPublished: QuizCardViewModel[];
}

async function fetchRelatedQuizzesFromDb(
  slug: string,
  categorySlug: string,
  locale?: Locale
): Promise<Quiz[]> {
  const supabase = createPublicClient();
  const categories = await getPublicCategories();
  const category = categories.find((item) => item.slug === categorySlug);
  if (!category) throw new Error(`Unknown category: ${categorySlug}`);

  let query = supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('category_id', category.id)
    .neq('slug', slug);
  if (locale) query = query.eq('language', locale);

  const { data, error } = await query.order('plays_count', { ascending: false }).limit(3);
  if (error || !data) throw error ?? new Error('Could not fetch related quizzes');

  const rows = [...(data as QuizRow[])];
  if (rows.length < 3) {
    let popular = supabase.from('quizzes').select('*').eq('status', 'published').neq('slug', slug);
    if (locale) popular = popular.eq('language', locale);
    const { data: extra } = await popular.order('plays_count', { ascending: false }).limit(10);
    const seen = new Set(rows.map((row) => row.slug));
    for (const row of (extra ?? []) as QuizRow[]) {
      if (rows.length >= 3) break;
      if (!seen.has(row.slug)) {
        seen.add(row.slug);
        rows.push(row);
      }
    }
  }

  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const related = rows.slice(0, 3).map((row) => normalizeQuiz(row, categoryMap));
  return locale ? localizeQuizList(related, locale) : related;
}

type CategorySlugJoin = { slug: string | null } | { slug: string | null }[] | null;

async function fetchQuizCategorySlugFromDb(slug: string, locale?: Locale): Promise<string | null> {
  const supabase = createPublicClient();
  let query = supabase
    .from('quizzes')
    .select('category:categories(slug)')
    .eq('slug', slug)
    .eq('status', 'published');
  if (locale) query = query.eq('language', locale);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const join = (data as unknown as { category: CategorySlugJoin } | null)?.category ?? null;
  const row = Array.isArray(join) ? join[0] : join;
  return row?.slug ?? null;
}

function fetchQuizCategorySlugCached(slug: string, locale?: Locale): Promise<string | null> {
  return unstable_cache(fetchQuizCategorySlugFromDb, ['quiz-category', slug], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_TAGS.quizzes, CATALOG_TAGS.quiz(slug)],
  })(slug, locale);
}

/**
 * Relacionados de la ficha sin esperar al quiz normalizado (PERF-10): resuelve
 * la categoría con una sonda de una columna, cacheada por slug, y recién
 * entonces consulta los relacionados. Se llama en paralelo con
 * `getQuizBySlug`, así la segunda consulta no suma al TTFB.
 *
 * Si la sonda falla o el quiz no está en la base, cae al catálogo de
 * lanzamiento igual que `getRelatedQuizzes`.
 */
export async function getRelatedQuizzesBySlug(slug: string, locale?: Locale): Promise<Quiz[]> {
  const categorySlug =
    (await fetchQuizCategorySlugCached(slug, locale).catch(() => null)) ??
    LAUNCH_QUIZZES.find((quiz) => quiz.slug === slug)?.category?.slug ??
    null;
  return categorySlug ? getRelatedQuizzes(slug, categorySlug, locale) : [];
}

// Relacionados de la misma categoría; si no llegan a 3, se completan con los
// más jugados del mismo idioma. Se cachean por slug: un like o una edición de
// este quiz invalida solo su entrada.
export async function getRelatedQuizzes(
  slug: string,
  categorySlug?: string | null,
  locale?: Locale
): Promise<Quiz[]> {
  if (!categorySlug) return [];
  try {
    return await unstable_cache(fetchRelatedQuizzesFromDb, ['related-quizzes', slug], {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: [CATALOG_TAGS.quizzes, CATALOG_TAGS.quiz(slug)],
    })(slug, categorySlug, locale);
  } catch {
    const launch = LAUNCH_QUIZZES.filter(
      (quiz) =>
        quiz.slug !== slug &&
        quiz.category?.slug === categorySlug &&
        (!locale || quiz.language === locale)
    ).slice(0, 3);
    return locale ? localizeQuizList(launch, locale) : launch;
  }
}

export const getQuizSessionByShareToken = cache(
  async (shareToken: string): Promise<QuizSessionResult | null> => {
    try {
      const supabase = await createClient();
      const data = await fetchSessionByShareToken(supabase, shareToken);

      if (!data) {
        return null;
      }

      return normalizeGameSession(data);
    } catch {
      return null;
    }
  }
);

export interface LeaderboardEntry {
  rank: number;
  user: Profile;
  points: number;
  quizzesPlayed: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  hasMore: boolean;
}

/**
 * Lanza si falla la consulta, igual que `getWeeklyLeaderboard`: un error de
 * base de datos no puede llegar a la página como un ranking vacío (diría «sé
 * el primero» cuando en realidad el tablero no cargó). La API responde 503 y
 * la página muestra un aviso con reintento.
 *
 * Paginación real por `page` (SOC-06): pide una fila de más para que
 * `hasMore` sea exacto sin un count aparte.
 */
export const getLeaderboard = cache(async (limit = 50, page = 1): Promise<LeaderboardResult> => {
  const supabase = await createClient();
  const safePage = Number.isSafeInteger(page) && page >= 1 ? page : 1;
  const from = (safePage - 1) * limit;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('points', { ascending: false })
    .order('quizzes_played', { ascending: false })
    // Desempate único: sin él, dos páginas consecutivas de empate pueden
    // repetir u omitir jugadores (paginación por offset).
    .order('id', { ascending: true })
    .range(from, from + limit);

  if (error || !data) {
    throw error ?? new Error('Could not fetch leaderboard');
  }

  const rows = data as ProfileRow[];
  return {
    entries: rows.slice(0, limit).map((row, index) => ({
      rank: from + index + 1,
      user: normalizeProfile(row),
      points: row.points,
      quizzesPlayed: row.quizzes_played,
    })),
    hasMore: rows.length > limit,
  };
});

// null = el perfil no existe (404); un error de la consulta se propaga al
// error boundary — nunca se disfraza de perfil inexistente.
export const getProfileByUsername = cache(async (username: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeProfile(data as ProfileRow) : null;
});

// Tarjetas de "quizzes publicados" del perfil: solo columnas de tarjeta, sin
// questions/results (antes era select('*') y pagaba el payload entero por fila).
// null = la consulta falló: el perfil muestra aviso, no «no tiene quizzes».
export const getQuizzesByCreatorId = cache(async (creatorId: string): Promise<Quiz[] | null> => {
  try {
    const supabase = await createClient();
    const [{ data: quizzes, error: quizError }, { data: categories, error: categoryError }] =
      await Promise.all([
        supabase
          .from('quizzes')
          .select(CATEGORY_CARD_COLUMNS)
          .eq('creator_id', creatorId)
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
      ]);

    if (quizError || !quizzes) {
      throw quizError ?? new Error('Could not fetch creator quizzes');
    }

    if (categoryError || !categories) {
      throw categoryError ?? new Error('Could not fetch categories');
    }

    const categoryMap = new Map(
      (categories as CategoryRow[]).map((item) => [item.id, normalizeCategory(item)])
    );

    return (quizzes as unknown as CategoryCardRow[]).map((quiz) =>
      normalizeCategoryCard(quiz, categoryMap)
    );
  } catch {
    return null;
  }
});

export const getUnlockedAchievements = cache(async (userId: string): Promise<Achievement[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement:achievements(*)')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error || !data) {
      throw error ?? new Error('Could not fetch achievements');
    }

    return (data as Array<{ achievement: AchievementRow | null }>).flatMap((item) =>
      item.achievement ? [normalizeAchievement(item.achievement)] : []
    );
  } catch {
    return [];
  }
});

// Lo que pinta una fila de las listas de seguidores/siguiendo.
export interface FollowListEntry {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  quizzes_played: number;
}

export interface FollowListResult {
  entries: FollowListEntry[];
  total: number;
  page: number;
  pageCount: number;
}

export const FOLLOW_LIST_PAGE_SIZE = 24;

const FOLLOW_LIST_COLUMNS = 'id, username, display_name, avatar_url, points, quizzes_played';

/**
 * Lista pública del grafo de follows del perfil (`/followers`, `/following`).
 * Depende de la policy "Anyone can read follows" (006): si el grafo se
 * cierra a privado (decisión pendiente, SOC-09), las listas ajenas quedarán
 * vacías y las páginas muestran su estado vacío — no se rompen.
 *
 * null = la consulta falló: la página muestra aviso con reintento, no un
 * vacío falso.
 */
export const getFollowList = cache(
  async (
    userId: string,
    kind: 'followers' | 'following',
    page = 1
  ): Promise<FollowListResult | null> => {
    try {
      const supabase = await createClient();
      const safePage = Number.isSafeInteger(page) && page >= 1 ? page : 1;
      const from = (safePage - 1) * FOLLOW_LIST_PAGE_SIZE;
      // En cada dirección el perfil cuelga de la otra FK.
      const embedded =
        kind === 'followers'
          ? `profile:profiles!user_follows_follower_id_fkey(${FOLLOW_LIST_COLUMNS})`
          : `profile:profiles!user_follows_following_id_fkey(${FOLLOW_LIST_COLUMNS})`;

      const { data, error, count } = await supabase
        .from('user_follows')
        .select(embedded, { count: 'exact' })
        .eq(kind === 'followers' ? 'following_id' : 'follower_id', userId)
        .order('created_at', { ascending: false })
        .range(from, from + FOLLOW_LIST_PAGE_SIZE - 1);

      if (error || !data) {
        throw error ?? new Error('Could not fetch follow list');
      }

      const total = count ?? from + data.length;
      return {
        entries: (data as Array<{ profile: FollowListEntry | null }>).flatMap((row) =>
          row.profile ? [row.profile] : []
        ),
        total,
        page: safePage,
        pageCount: Math.max(1, Math.ceil(total / FOLLOW_LIST_PAGE_SIZE)),
      };
    } catch {
      return null;
    }
  }
);
