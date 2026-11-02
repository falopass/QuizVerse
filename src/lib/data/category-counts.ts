import 'server-only';

import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { CATALOG_REVALIDATE_SECONDS, CATALOG_TAGS } from '@/lib/data/cache-tags';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import type { Locale } from '@/lib/i18n/dictionaries';

const PAGE_SIZE = 1000;

type CategoryJoin = { slug: string | null } | { slug: string | null }[] | null;

function categorySlug(join: CategoryJoin): string | null {
  const row = Array.isArray(join) ? join[0] : join;
  return row?.slug ?? null;
}

// Counts published quizzes per category slug without fetching question or
// result payloads. Cached across requests with the `quizzes` tag: it used to
// walk the catalog on every home, category and layout request (PERF-16).
// Throws on failure; each caller decides its own fallback.
async function fetchPublishedQuizCounts(locale: Locale): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const supabase = createPublicClient();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('quizzes')
      .select('category:categories(slug)')
      .eq('status', 'published')
      .eq('language', locale)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data) throw error ?? new Error('Could not count published quizzes');

    for (const row of data as { category: CategoryJoin }[]) {
      const slug = categorySlug(row.category);
      if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
    }

    if (data.length < PAGE_SIZE) return counts;
  }
}

const fetchPublishedQuizCountsCached = unstable_cache(
  fetchPublishedQuizCounts,
  ['published-quiz-counts'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAGS.quizzes, CATALOG_TAGS.categories] }
);

export async function getCategoryCounts(locale: Locale): Promise<Map<string, number>> {
  try {
    return new Map(Object.entries(await fetchPublishedQuizCountsCached(locale)));
  } catch {
    return new Map();
  }
}

// Categorías con al menos un quiz publicado en el locale, el mismo criterio
// con el que el sitemap decide qué hubs existen.
export async function getPopulatedCategorySlugs(locale: Locale): Promise<Set<string>> {
  try {
    return new Set(Object.keys(await fetchPublishedQuizCountsCached(locale)));
  } catch {
    // Un fallo no se cachea: el siguiente request reintenta y el footer se
    // recupera en cuanto vuelve la base. Mientras tanto se enlazan las del
    // catálogo de lanzamiento, que es lo que renderiza la página de categoría.
    return new Set(
      LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale)
        .map((quiz) => quiz.category?.slug)
        .filter((slug): slug is string => Boolean(slug))
    );
  }
}
