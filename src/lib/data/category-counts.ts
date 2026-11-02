import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import type { Locale } from '@/lib/i18n/dictionaries';

const PAGE_SIZE = 1000;

type CategoryJoin = { slug: string | null } | { slug: string | null }[] | null;

function categorySlug(join: CategoryJoin): string | null {
  const row = Array.isArray(join) ? join[0] : join;
  return row?.slug ?? null;
}

// Counts published quizzes per category slug without fetching question or
// result payloads. Never throws: on failure the home page just filters
// categories like it does today.
async function countPublishedQuizzes(
  locale: Locale
): Promise<{ counts: Map<string, number>; failed: boolean }> {
  const counts = new Map<string, number>();

  try {
    const supabase = await createClient();

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('quizzes')
        .select('category:categories(slug)')
        .eq('status', 'published')
        .eq('language', locale)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);

      if (error || !data) return { counts: new Map(), failed: true };

      for (const row of data as { category: CategoryJoin }[]) {
        const slug = categorySlug(row.category);
        if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }

      if (data.length < PAGE_SIZE) return { counts, failed: false };
    }
  } catch {
    return { counts: new Map(), failed: true };
  }
}

export async function getCategoryCounts(locale: Locale): Promise<Map<string, number>> {
  return (await countPublishedQuizzes(locale)).counts;
}

// Categorías con al menos un quiz publicado en el locale, el mismo criterio
// con el que el sitemap decide qué hubs existen. Memoizado por isolate durante
// 10 minutos para que el footer, que se pinta en cada página, no pague el
// conteo en cada request.
const POPULATED_TTL_MS = 10 * 60 * 1000;
const populatedCache = new Map<Locale, { at: number; slugs: string[] }>();

export async function getPopulatedCategorySlugs(locale: Locale): Promise<Set<string>> {
  const cached = populatedCache.get(locale);
  if (cached && Date.now() - cached.at < POPULATED_TTL_MS) return new Set(cached.slugs);

  const { counts, failed } = await countPublishedQuizzes(locale);
  // Un conteo vacío es un idioma sin quizzes: sus hubs hacen notFound(), así
  // que no se enlaza ninguno. Solo si la consulta falló se cae al catálogo de
  // lanzamiento, que es lo que las páginas de categoría renderizan entonces.
  const slugs = failed
    ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale)
        .map((quiz) => quiz.category?.slug)
        .filter((slug): slug is string => Boolean(slug))
    : [...counts.keys()];

  // Un fallo no se memoiza: el siguiente request reintenta y el footer se
  // recupera en cuanto vuelve la base.
  if (!failed) populatedCache.set(locale, { at: Date.now(), slugs: [...new Set(slugs)] });
  return new Set(slugs);
}
