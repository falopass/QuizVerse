import { createClient } from '@/lib/supabase/server';
import { normalizeCategory, normalizeQuiz } from '@/lib/data/normalizers';
import type { CategoryRow, QuizRow } from '@/lib/data/normalizers';
import type { Category, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

export async function fetchPublicCategoriesFromDb(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error || !data) {
    throw error ?? new Error('Could not fetch categories');
  }
  return (data as CategoryRow[]).map(normalizeCategory);
}

export async function fetchPublishedQuizzesFromDb(limit = 40, locale?: Locale): Promise<Quiz[]> {
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

  const categoryMap = new Map(
    (categories as CategoryRow[]).map((item) => [item.id, normalizeCategory(item)])
  );

  return (quizzes as QuizRow[]).map((quiz) => normalizeQuiz(quiz, categoryMap));
}

export async function fetchPublishedQuizTotalsFromDb(locale?: Locale): Promise<{
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

export async function fetchQuizBySlugFromDb(slug: string, locale?: Locale): Promise<Quiz | null> {
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
  const categoryResponse: { data: CategoryRow | null } = quizRow.category_id
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
