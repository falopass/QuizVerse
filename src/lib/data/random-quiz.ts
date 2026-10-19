import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/dictionaries';

// Picks a published quiz slug of the locale without fetching the catalog:
// one count query, then a single row at a random offset. Never throws; a
// failure is indistinguishable from an empty catalog for the caller.
export async function getRandomQuizSlug(locale: Locale): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('language', locale);

    if (countError || !count) return null;

    const offset = Math.floor(Math.random() * count);
    const { data, error } = await supabase
      .from('quizzes')
      .select('slug')
      .eq('status', 'published')
      .eq('language', locale)
      .order('slug')
      .range(offset, offset);

    if (error || !data || data.length === 0) return null;
    return data[0].slug;
  } catch {
    return null;
  }
}
