import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { LAUNCH_CATEGORIES, LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import type { Database } from '@/types/database';
import type {
  Achievement,
  Answer,
  Category,
  PersonalityResult,
  Profile,
  Question,
  Quiz,
  QuizCardViewModel,
  QuizSessionResult,
} from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';
import { inferVisualProfile } from '@/lib/design/visual-profile';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type QuizRow = Database['public']['Tables']['quizzes']['Row'];
type GameSessionRow = Database['public']['Tables']['game_sessions']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type AchievementRow = Database['public']['Tables']['achievements']['Row'];

function parseAnswers(input: GameSessionRow['answers']): Answer[] | null {
  return Array.isArray(input) ? (input as unknown as Answer[]) : null;
}

function normalizeGameSession(row: GameSessionRow): QuizSessionResult {
  return {
    id: row.id,
    quiz_id: row.quiz_id,
    player_id: row.player_id,
    score: row.score,
    max_score: row.max_score,
    percentage: row.max_score > 0 ? Math.round((row.score / row.max_score) * 100) : 0,
    result_id: row.result_id,
    result_title: row.result_title,
    time_taken_seconds: row.time_taken_seconds,
    answers: parseAnswers(row.answers),
    share_token: row.share_token,
    was_shared: row.was_shared,
    completed_at: row.completed_at,
  };
}

function normalizeCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    color: row.color,
    gradient_from: row.gradient_from,
    gradient_to: row.gradient_to,
    quiz_count: row.quiz_count,
    sort_order: row.sort_order,
  };
}

function normalizeProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    points: row.points,
    quizzes_played: row.quizzes_played,
    quizzes_created: row.quizzes_created,
    is_admin: row.is_admin,
    is_verified: row.is_verified,
    preferred_language: row.preferred_language,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeAchievement(row: AchievementRow): Achievement {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    points_reward: row.points_reward,
    condition_type: row.condition_type,
    condition_value: row.condition_value,
  };
}

function parseQuestions(
  input: Database['public']['Tables']['quizzes']['Row']['questions']
): Question[] {
  return Array.isArray(input) ? (input as unknown as Question[]) : [];
}

function parseResults(
  input: Database['public']['Tables']['quizzes']['Row']['results']
): PersonalityResult[] | null {
  return Array.isArray(input) ? (input as unknown as PersonalityResult[]) : null;
}

function normalizeQuiz(
  row: QuizRow,
  categories: Map<string, Category>,
  creator?: Profile | null
): Quiz {
  const normalizedQuiz: Quiz = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    cover_image_url: row.cover_image_url,
    quiz_type: row.quiz_type,
    difficulty: row.difficulty,
    language: row.language,
    questions: parseQuestions(row.questions),
    results: parseResults(row.results),
    tags: row.tags,
    estimated_minutes: row.estimated_minutes,
    plays_count: row.plays_count,
    shares_count: row.shares_count,
    avg_score: row.avg_score,
    likes_count: row.likes_count,
    status: row.status,
    is_featured: row.is_featured,
    is_ai_generated: row.is_ai_generated,
    published_at: row.published_at,
    created_at: row.created_at,
    category: row.category_id ? (categories.get(row.category_id) ?? null) : null,
    creator: creator ?? null,
  };

  return {
    ...normalizedQuiz,
    visual_profile: inferVisualProfile({
      title: normalizedQuiz.title,
      description: normalizedQuiz.description,
      quiz_type: normalizedQuiz.quiz_type,
      tags: normalizedQuiz.tags,
      category: normalizedQuiz.category ?? null,
      language: normalizedQuiz.language,
    }),
  };
}

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
  let quizQuery = supabase.from('quizzes').select('*').eq('status', 'published');

  if (locale) {
    quizQuery = quizQuery.eq('language', locale);
  }

  const [{ data: quizzes, error: quizError }, { data: categories, error: categoryError }] =
    await Promise.all([
      quizQuery.order('plays_count', { ascending: false }).limit(limit),
      supabase.from('categories').select('*').order('sort_order'),
    ]);

  if (quizError || !quizzes) {
    throw quizError ?? new Error('Could not fetch quizzes');
  }

  if (categoryError || !categories) {
    throw categoryError ?? new Error('Could not fetch categories');
  }

  const categoryRows = categories as CategoryRow[];
  const quizRows = quizzes as QuizRow[];
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

export async function getExplorePayload(
  localeOrSearch?: Locale | string,
  searchOrCategory?: string,
  maybeCategorySlug?: string
) {
  const locale = localeOrSearch === 'en' || localeOrSearch === 'es' ? localeOrSearch : undefined;
  const search = locale ? searchOrCategory : localeOrSearch;
  const categorySlug = locale ? maybeCategorySlug : searchOrCategory;
  const [quizzes, categories] = await Promise.all([
    getPublishedQuizzes(80, locale),
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

  return { quizzes: filtered, categories };
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

export async function getCategoryPayload(slug: string, locale?: Locale) {
  const [categories, quizzes] = await Promise.all([
    getPublicCategories(),
    getPublishedQuizzes(80, locale),
  ]);
  const category = categories.find((item) => item.slug === slug) ?? null;

  if (!category) {
    return null;
  }

  return {
    category,
    categories,
    quizzes: quizzes.filter((quiz) => quiz.category?.slug === slug),
  };
}

export interface HomeCardGroups {
  trending: QuizCardViewModel[];
  featured: QuizCardViewModel[];
  quickPlays: QuizCardViewModel[];
  freshlyPublished: QuizCardViewModel[];
}

export async function getRelatedQuizzes(
  slug: string,
  categorySlug?: string | null,
  locale?: Locale
) {
  const quizzes = await getPublishedQuizzes(24, locale);
  return quizzes
    .filter((quiz) => quiz.slug !== slug && quiz.category?.slug === categorySlug)
    .slice(0, 3);
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
