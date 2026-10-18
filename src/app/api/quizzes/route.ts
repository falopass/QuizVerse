import { QuizQuerySchema, jsonError, jsonOk, parseQuery } from '@/lib/api/query';
import { listPublishedQuizzes } from '@/lib/data/catalog';

export const revalidate = 60;

/**
 * GET /api/quizzes?locale=&category=&q=&page=&limit=
 *
 * Catálogo publicado, paginado. No devuelve preguntas ni respuestas: solo la
 * tarjeta que necesita cualquier cliente (web, embed, app).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(QuizQuerySchema, searchParams);
  if (!parsed.ok) return jsonError(400, 'invalid_query', parsed.fieldErrors);

  try {
    const page = await listPublishedQuizzes(parsed.data);
    return jsonOk(page);
  } catch {
    return jsonError(503, 'catalog_unavailable');
  }
}
