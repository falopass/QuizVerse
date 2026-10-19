import 'server-only';

import { createClient } from '@/lib/supabase/server';
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
export async function getCategoryCounts(locale: Locale): Promise<Map<string, number>> {
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

      if (error || !data) return new Map();

      for (const row of data as { category: CategoryJoin }[]) {
        const slug = categorySlug(row.category);
        if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }

      if (data.length < PAGE_SIZE) return counts;
    }
  } catch {
    return new Map();
  }
}
