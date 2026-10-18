import { PaginationSchema, jsonError, jsonOk, parseQuery } from '@/lib/api/query';
import { getLeaderboard } from '@/lib/data/public';

export const revalidate = 60;

/**
 * GET /api/leaderboard?limit=
 *
 * Ranking global por puntos. `page` se acepta pero el ranking actual solo corta
 * por `limit`; cuando haya ranking entre amigos vivirá en este mismo endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(PaginationSchema, searchParams);
  if (!parsed.ok) return jsonError(400, 'invalid_query', parsed.fieldErrors);

  try {
    const entries = await getLeaderboard(parsed.data.limit);
    return jsonOk({ entries, total: entries.length, limit: parsed.data.limit });
  } catch {
    return jsonError(503, 'leaderboard_unavailable');
  }
}
