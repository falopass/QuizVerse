/**
 * Lecturas del catálogo para las rutas públicas.
 *
 * `public.ts` sirve a los Server Components con `cache()` de React; esto es la
 * versión para Route Handlers: filtros, paginación y contadores reales, sin
 * serializar preguntas ni la clave de respuestas.
 */

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { QuizQuery } from '@/lib/api/query';

type QuizRow = Database['public']['Tables']['quizzes']['Row'];

/** Columnas que `toCard` necesita: `questions`, `correct_answers` y `results` no viajan por el API. */
const CARD_COLUMNS =
  'id, slug, title, description, quiz_type, difficulty, language, question_count, estimated_minutes, plays_count, cover_image_url';

type CardRow = Pick<
  QuizRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'description'
  | 'quiz_type'
  | 'difficulty'
  | 'language'
  | 'question_count'
  | 'estimated_minutes'
  | 'plays_count'
  | 'cover_image_url'
>;

export interface CatalogCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  quizType: QuizRow['quiz_type'];
  difficulty: QuizRow['difficulty'];
  language: string;
  questionCount: number;
  estimatedMinutes: number;
  plays: number;
  coverImageUrl: string | null;
}

export interface CatalogPage {
  items: CatalogCard[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Escapa los comodines de `like` para que la búsqueda sea literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toCard(row: CardRow): CatalogCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    quizType: row.quiz_type,
    difficulty: row.difficulty,
    language: row.language,
    questionCount: row.question_count ?? 0,
    estimatedMinutes: row.estimated_minutes ?? 3,
    plays: row.plays_count ?? 0,
    coverImageUrl: row.cover_image_url,
  };
}

/**
 * Página del catálogo publicado.
 *
 * `category` acepta tanto un slug de la tabla `categories` como los hubs de
 * tipo (`trivia`, `personality`), que no tienen fila propia.
 */
export async function listPublishedQuizzes(query: QuizQuery): Promise<CatalogPage> {
  const supabase = await createClient();
  const { page, limit, locale, category, q } = query;

  let queryBuilder = supabase
    .from('quizzes')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'published');

  if (locale) queryBuilder = queryBuilder.eq('language', locale);

  if (category === 'trivia' || category === 'personality') {
    queryBuilder = queryBuilder.eq('quiz_type', category);
  } else if (category) {
    const { data: categoryRows } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .limit(1);

    const categoryId = (categoryRows as Array<{ id: string }> | null)?.[0]?.id;

    if (!categoryId) {
      return { items: [], total: 0, page, limit, hasMore: false };
    }
    queryBuilder = queryBuilder.eq('category_id', categoryId);
  }

  const term = q?.trim();
  if (term) {
    // Dentro del `or` los valores van entrecomillados y ahí PostgREST usa `\`
    // como escape (`\"`→`"`, `\\`→`\`): lo ya escapado para SQL se vuelve a
    // escapar para el quoting. Misma transformación en las dos capas.
    const escapeQuoted = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const pattern = `%${escapeLike(term)}%`;
    // tags es text[]: `cs` pide un literal de array y las comillas internas
    // mantienen el término como un solo elemento (comas incluidas).
    // shortcut: `cs` es match exacto del elemento — ni substring ni
    // case-insensitive como el explorador; upgrade = columna computada.
    const tagLiteral = `{"${escapeQuoted(term)}"}`;
    queryBuilder = queryBuilder.or(
      `title.ilike."${escapeQuoted(pattern)}",description.ilike."${escapeQuoted(pattern)}",tags.cs."${escapeQuoted(tagLiteral)}"`
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await queryBuilder
    .order('plays_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error || !data) {
    throw new Error(`catalog_query_failed: ${error?.message ?? 'no data'}`);
  }

  const total = count ?? data.length;
  return {
    items: (data as CardRow[]).map(toCard),
    total,
    page,
    limit,
    hasMore: from + data.length < total,
  };
}

export interface CatalogStats {
  quizzes: number;
  byLocale: Record<Locale, number>;
  byType: Record<'trivia' | 'personality', number>;
  categories: number;
  plays: number;
}

/** Agregados públicos: cuatro counts y una suma, todo sobre filas publicadas. */
export async function getCatalogStats(): Promise<CatalogStats> {
  const supabase = await createClient();

  const [total, en, es, trivia, personality, categories, plays] = await Promise.all([
    supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('language', 'en'),
    supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('language', 'es'),
    supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('quiz_type', 'trivia'),
    supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('quiz_type', 'personality'),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
    supabase.from('quizzes').select('plays_count').eq('status', 'published'),
  ]);

  const firstError =
    total.error ??
    en.error ??
    es.error ??
    trivia.error ??
    personality.error ??
    categories.error ??
    plays.error;

  if (firstError) {
    throw new Error(`stats_query_failed: ${firstError.message}`);
  }

  const totalPlays = (plays.data ?? []).reduce(
    (sum, row) => sum + ((row as { plays_count: number | null }).plays_count ?? 0),
    0
  );

  return {
    quizzes: total.count ?? 0,
    byLocale: { en: en.count ?? 0, es: es.count ?? 0 },
    byType: { trivia: trivia.count ?? 0, personality: personality.count ?? 0 },
    categories: categories.count ?? 0,
    plays: totalPlays,
  };
}
