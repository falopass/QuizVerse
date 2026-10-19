import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';
import type { QuizType } from '@/types/database';

/**
 * Card-level shape for `/{locale}/novedades`. Deliberately narrow: the page
 * never loads `questions` nor `correct_answers`, so the answer key can't leak
 * into a public listing.
 */
export interface WhatsNewQuiz {
  slug: string;
  title: string;
  description: string | null;
  language: string;
  quiz_type: QuizType;
  estimated_minutes: number;
  published_at: string | null;
  created_at: string;
  category: { slug: string; name: string } | null;
}

const WHATS_NEW_COLUMNS =
  'slug, title, description, language, quiz_type, estimated_minutes, published_at, created_at, category:categories(slug, name)';

async function fetchWhatsNewFromDb(limit: number, locale?: Locale): Promise<WhatsNewQuiz[]> {
  const supabase = await createClient();
  let query = supabase.from('quizzes').select(WHATS_NEW_COLUMNS).eq('status', 'published');
  // /{locale}/quiz/{slug} 404 para slugs de otro idioma: la lista se filtra.
  if (locale) query = query.eq('language', locale);

  const { data, error } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    throw error ?? new Error('Could not fetch recent quizzes');
  }

  return data as unknown as WhatsNewQuiz[];
}

function recencyTime(item: { published_at: string | null; created_at: string }): number {
  return new Date(item.published_at ?? item.created_at).getTime();
}

function toWhatsNewQuiz(quiz: Quiz): WhatsNewQuiz {
  return {
    slug: quiz.slug,
    title: quiz.title,
    description: quiz.description,
    language: quiz.language,
    quiz_type: quiz.quiz_type,
    estimated_minutes: quiz.estimated_minutes,
    published_at: quiz.published_at,
    created_at: quiz.created_at,
    category: quiz.category ? { slug: quiz.category.slug, name: quiz.category.name } : null,
  };
}

export const getWhatsNew = cache(async (limit = 30, locale?: Locale): Promise<WhatsNewQuiz[]> => {
  try {
    return await fetchWhatsNewFromDb(limit, locale);
  } catch {
    const launch = locale
      ? LAUNCH_QUIZZES.filter((quiz) => quiz.language === locale)
      : LAUNCH_QUIZZES;
    return launch
      .map(toWhatsNewQuiz)
      .sort((a, b) => recencyTime(b) - recencyTime(a))
      .slice(0, limit);
  }
});

/**
 * Parte la lista en dos: lo publicado dentro de `days` días respecto a `now`
 * (límite incluido) y lo anterior. Ambas salen ordenadas de más a menos
 * reciente, usando `published_at` y cayendo a `created_at` cuando es nulo.
 */
export function partitionByRecency<T extends { published_at: string | null; created_at: string }>(
  items: T[],
  now: Date,
  days = 7
): { fresh: T[]; older: T[] } {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const fresh: T[] = [];
  const older: T[] = [];
  for (const item of [...items].sort((a, b) => recencyTime(b) - recencyTime(a))) {
    (recencyTime(item) >= cutoff ? fresh : older).push(item);
  }
  return { fresh, older };
}
