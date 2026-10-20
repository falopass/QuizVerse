import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import type { Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';
import { isLastPage, pageRanges, QUIZ_MAX_ROWS, QUIZ_PAGE_SIZE } from './quiz-pagination';

// Fila mínima para páginas que solo enlazan el catálogo (/indice): no trae
// questions ni results, que son lo que infla el select('*') hasta ~1 MB.
export interface CatalogCard {
  slug: string;
  title: string;
  quiz_type: Quiz['quiz_type'];
  category: { slug: string; name: string } | null;
}

type CategoryJoin =
  | { slug: string | null; name: string | null }
  | { slug: string | null; name: string | null }[]
  | null;

interface CatalogCardRow {
  slug: string;
  title: string;
  quiz_type: Quiz['quiz_type'];
  category: CategoryJoin;
}

function toCatalogCard(row: CatalogCardRow): CatalogCard {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  return {
    slug: row.slug,
    title: row.title,
    quiz_type: row.quiz_type,
    category: category?.slug ? { slug: category.slug, name: category.name ?? category.slug } : null,
  };
}

// Mismo patrón que fetchPublishedQuizzesFromDb en public.ts: scan ordenado
// por id (inmutable) en rangos de QUIZ_PAGE_SIZE para no topar el límite de
// 1000 filas de Supabase. /indice reordena por título, así que el orden de
// llegada no cambia el HTML.
async function fetchCatalogCardsFromDb(locale: Locale): Promise<CatalogCard[]> {
  const supabase = await createClient();
  const rows: CatalogCardRow[] = [];

  for (const { from, to } of pageRanges(QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS)) {
    const { data, error } = await supabase
      .from('quizzes')
      .select('slug, title, quiz_type, category:categories(slug, name)')
      .eq('status', 'published')
      .eq('language', locale)
      .order('id', { ascending: true })
      .range(from, to);
    if (error || !data) {
      throw error ?? new Error('Could not fetch catalog cards');
    }
    rows.push(...(data as unknown as CatalogCardRow[]));
    if (isLastPage(data.length, to - from + 1)) {
      break;
    }
  }

  return rows.map(toCatalogCard);
}

// Nunca lanza: si Supabase falla, /indice pinta el catálogo de lanzamiento,
// igual que getPublishedQuizzes en public.ts.
export const getCatalogCards = cache(async (locale: Locale): Promise<CatalogCard[]> => {
  try {
    return await fetchCatalogCardsFromDb(locale);
  } catch {
    return LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale).map((quiz) => ({
      slug: quiz.slug,
      title: quiz.title,
      quiz_type: quiz.quiz_type,
      category: quiz.category ? { slug: quiz.category.slug, name: quiz.category.name } : null,
    }));
  }
});
