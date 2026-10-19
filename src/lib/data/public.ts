import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { LAUNCH_CATEGORIES, LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import {
  normalizeCategory,
  normalizeQuiz,
  normalizeProfile,
  normalizeGameSession,
  normalizeAchievement,
  type CategoryRow,
  type QuizRow,
  type GameSessionRow,
  type ProfileRow,
  type AchievementRow,
} from '@/lib/data/normalizers';
import type {
  Achievement,
  Category,
  Profile,
  Quiz,
  QuizCardViewModel,
  QuizSessionResult,
} from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';
import { isLastPage, pageRanges, QUIZ_MAX_ROWS, QUIZ_PAGE_SIZE } from './quiz-pagination';
import { localizeQuizList } from '@/lib/i18n/catalog';

async function fetchPublicCategoriesFromDb(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error || !data) {
    throw error ?? new Error('Could not fetch categories');
  }
  return data.map(normalizeCategory);
}

async function fetchPublishedQuizzesFromDb(limit = 40, locale?: Locale): Promise<Quiz[]> {
  const supabase = await createClient();
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

async function fetchPublishedQuizTotalsFromDb(locale?: Locale): Promise<{
  totalQuizzes: number;
  totalPlays: number;
}> {
  const supabase = await createClient();
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

async function fetchQuizBySlugFromDb(slug: string, locale?: Locale): Promise<Quiz | null> {
  const supabase = await createClient();
  let query = supabase.from('quizzes').select('*').eq('slug', slug).eq('status', 'published');

  if (locale) {
    query = query.eq('language', locale);
  }

  const { data: quiz, error } = await query.single();

  if (error || !quiz) {
    return null;
  }

  const quizRow = quiz as QuizRow;
  const categoryResponse: { data: CategoryRow | null } | { data: null } = quizRow.category_id
    ? ((await supabase.from('categories').select('*').eq('id', quizRow.category_id).single()) as {
        data: CategoryRow | null;
      })
    : { data: null };

  const categoryMap = new Map<string, Category>();

  if (categoryResponse.data) {
    categoryMap.set(categoryResponse.data.id, normalizeCategory(categoryResponse.data));
  }

  return normalizeQuiz(quizRow, categoryMap);
}

export const getPublicCategories = cache(async (): Promise<Category[]> => {
  try {
    return await fetchPublicCategoriesFromDb();
  } catch {
    return LAUNCH_CATEGORIES;
  }
});

export const getPublishedQuizzes = cache(async (limit = 40, locale?: Locale): Promise<Quiz[]> => {
  try {
    return await fetchPublishedQuizzesFromDb(limit, locale);
  } catch {
    const launch = locale
      ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale)
      : LAUNCH_QUIZZES;
    return launch.slice(0, limit);
  }
});

export const getQuizBySlug = cache(async (slug: string, locale?: Locale): Promise<Quiz | null> => {
  try {
    return await fetchQuizBySlugFromDb(slug, locale);
  } catch {
    const launch = LAUNCH_QUIZZES.filter((quiz) => quiz.slug === slug);
    return (locale ? launch.find((quiz) => quiz.language === locale) : launch[0]) ?? null;
  }
});

export const getPublishedQuizCount = cache(async (locale?: Locale): Promise<number> => {
  try {
    return (await fetchPublishedQuizTotalsFromDb(locale)).totalQuizzes;
  } catch {
    return locale
      ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale).length
      : LAUNCH_QUIZZES.length;
  }
});

export async function getExplorePayload(
  localeOrSearch?: Locale | string,
  searchOrCategory?: string,
  maybeCategorySlug?: string
) {
  const locale = localeOrSearch === 'en' || localeOrSearch === 'es' ? localeOrSearch : undefined;
  const search = locale ? searchOrCategory : localeOrSearch;
  const categorySlug = locale ? maybeCategorySlug : searchOrCategory;
  const [quizzes, categories] = await Promise.all([
    getPublishedQuizzes(QUIZ_MAX_ROWS, locale),
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

export async function getHomePayload(locale?: Locale) {
  const [quizzes, categories, totals] = await Promise.all([
    getPublishedQuizzes(24, locale),
    getPublicCategories(),
    (async () => {
      try {
        return await fetchPublishedQuizTotalsFromDb(locale);
      } catch {
        const launch = locale
          ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale)
          : LAUNCH_QUIZZES;

        return {
          totalQuizzes: launch.length,
          totalPlays: launch.reduce((total, quiz) => total + quiz.plays_count, 0),
        };
      }
    })(),
  ]);

  const trending = [...quizzes].sort((a, b) => b.plays_count - a.plays_count).slice(0, 6);
  const featured = quizzes.filter((quiz) => quiz.is_featured).slice(0, 4);
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

export const getCategoryPayload = cache(async (slug: string, locale?: Locale) => {
  const categories = await getPublicCategories();
  const category = categories.find((item) => item.slug === slug) ?? null;
  const isType = slug === 'personality' || slug === 'trivia';
  if (!category && !isType) {
    return null;
  }
  let quizzes: Quiz[];
  try {
    const supabase = await createClient();
    const rows: QuizRow[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = supabase.from('quizzes').select('*').eq('status', 'published');
      query = isType ? query.eq('quiz_type', slug) : query.eq('category_id', category!.id);
      if (locale) query = query.eq('language', locale);
      const { data, error } = await query
        .order('plays_count', { ascending: false })
        .range(offset, offset + 499);
      if (error || !data) throw error ?? new Error('Could not fetch category quizzes');
      rows.push(...(data as QuizRow[]));
      if (data.length < 500) break;
    }
    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    quizzes = rows.map((row) => normalizeQuiz(row, categoryMap));
  } catch {
    quizzes = LAUNCH_QUIZZES.filter(
      (quiz) =>
        (isType ? quiz.quiz_type === slug : quiz.category?.slug === slug) &&
        (!locale || quiz.language === locale)
    );
  }
  const populated = new Set(
    (await getPublishedQuizzes(QUIZ_MAX_ROWS, locale)).map((quiz) => quiz.category?.slug)
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
      quiz_count: quizzes.length,
      sort_order: 0,
    },
    categories: categories.filter((item) => populated.has(item.slug)),
    quizzes,
  };
});

export interface HomeCardGroups {
  trending: QuizCardViewModel[];
  featured: QuizCardViewModel[];
  quickPlays: QuizCardViewModel[];
  freshlyPublished: QuizCardViewModel[];
}

// Relacionados de la misma categoría; si no llegan a 3, se completan con los
// más jugados del mismo idioma.
export async function getRelatedQuizzes(
  slug: string,
  categorySlug?: string | null,
  locale?: Locale
): Promise<Quiz[]> {
  if (!categorySlug) return [];
  try {
    const [supabase, categories] = await Promise.all([createClient(), getPublicCategories()]);
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
      let popular = supabase
        .from('quizzes')
        .select('*')
        .eq('status', 'published')
        .neq('slug', slug);
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
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('share_token', shareToken)
        .single();

      if (error || !data) {
        return null;
      }

      return normalizeGameSession(data as GameSessionRow);
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

export const getLeaderboard = cache(async (limit = 50): Promise<LeaderboardEntry[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('points', { ascending: false })
      .order('quizzes_played', { ascending: false })
      .limit(limit);

    if (error || !data) {
      throw error ?? new Error('Could not fetch leaderboard');
    }

    return (data as ProfileRow[]).map((row, index) => ({
      rank: index + 1,
      user: normalizeProfile(row),
      points: row.points,
      quizzesPlayed: row.quizzes_played,
    }));
  } catch {
    return [];
  }
});

export const getProfileByUsername = cache(async (username: string): Promise<Profile | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return null;
    }

    return normalizeProfile(data as ProfileRow);
  } catch {
    return null;
  }
});

export const getQuizzesByCreatorId = cache(async (creatorId: string): Promise<Quiz[]> => {
  try {
    const supabase = await createClient();
    const [{ data: quizzes, error: quizError }, { data: categories, error: categoryError }] =
      await Promise.all([
        supabase
          .from('quizzes')
          .select('*')
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

    return (quizzes as QuizRow[]).map((quiz) => normalizeQuiz(quiz, categoryMap));
  } catch {
    return [];
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
