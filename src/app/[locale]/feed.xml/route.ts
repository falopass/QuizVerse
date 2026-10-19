import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { buildAtomFeed, type FeedQuiz } from '@/lib/seo/feed';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600;

const FEED_LIMIT = 30;

/**
 * Query propia del feed: `getPublishedQuizzes` ordena por `plays_count` antes
 * del `LIMIT`, así que un quiz recién publicado (0 plays) quedaría fuera del
 * top 30 y nunca llegaría a los suscriptores. Aquí el corte lo hace la DB por
 * `published_at` descendente, con `id` como desempate determinista.
 *
 * Un error de lectura devuelve `null` (no el catálogo de lanzamiento): servir
 * entradas viejas con 200 haría que los lectores las adopten como el feed
 * actual; un 503 les deja conservar la última versión buena, igual que el
 * sitemap.
 */
async function fetchNewestQuizzes(locale: Locale): Promise<FeedQuiz[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quizzes')
      .select('slug, title, description, published_at, updated_at, created_at')
      .eq('status', 'published')
      .eq('language', locale)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(FEED_LIMIT);

    if (error || !data) return null;
    return data as FeedQuiz[];
  } catch {
    return null;
  }
}

/** Máximo de la fecha efectiva de cada entrada: `updated_at` si existe, si no la de publicación. */
function feedUpdatedAt(quizzes: FeedQuiz[]): string {
  const max = quizzes.reduce((acc, quiz) => {
    const time = new Date(quiz.updated_at ?? quiz.published_at ?? quiz.created_at).getTime();
    return Number.isNaN(time) ? acc : Math.max(acc, time);
  }, 0);
  return max ? new Date(max).toISOString() : new Date().toISOString();
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const quizzes = await fetchNewestQuizzes(locale);
  if (quizzes === null) {
    console.error('[feed] no se pudo leer el catálogo');
    return new NextResponse('feed unavailable', {
      status: 503,
      headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' },
    });
  }

  const xml = buildAtomFeed({ locale, quizzes, updated: feedUpdatedAt(quizzes) });
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
}
