import { z } from 'zod';
import { PaginationSchema, jsonError, jsonOk, parseQuery } from '@/lib/api/query';
import { getLeaderboard } from '@/lib/data/public';
import { getWeeklyLeaderboard } from '@/lib/profile/weekly-ranking';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

const LeaderboardQuerySchema = PaginationSchema.extend({
  /** `friends` incluye al jugador y a quienes sigue. Requiere sesión. */
  scope: z.enum(['global', 'friends']).default('global'),
  /** `week` solo aplica al scope global: partidas de los últimos 7 días. */
  window: z.enum(['all', 'week']).default('all'),
});

/**
 * GET /api/leaderboard?scope=global|friends&window=all|week&limit=
 *
 * Ranking por puntos. `friends` se limita a la red de `user_follows` del
 * jugador autenticado (más él mismo) y devuelve 401 si no hay sesión.
 * `window=week` devuelve el ranking de actividad de los últimos 7 días.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(LeaderboardQuerySchema, searchParams);
  if (!parsed.ok) return jsonError(400, 'invalid_query', parsed.fieldErrors);

  const { limit, scope, window: windowParam } = parsed.data;

  if (scope === 'global') {
    try {
      const entries =
        windowParam === 'week' ? await getWeeklyLeaderboard(limit) : await getLeaderboard(limit);
      return jsonOk({ scope, entries, total: entries.length, limit });
    } catch {
      return jsonError(503, 'leaderboard_unavailable');
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError(401, 'unauthorized');

  const { data: follows, error: followsError } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (followsError) return jsonError(503, 'leaderboard_unavailable');

  const ids = [user.id, ...(follows ?? []).map((f) => f.following_id)];

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids)
    .order('points', { ascending: false })
    .limit(limit);

  if (error) return jsonError(503, 'leaderboard_unavailable');

  const entries = (rows ?? []).map((row, index) => ({
    rank: index + 1,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    points: row.points,
    quizzesPlayed: row.quizzes_played,
  }));

  return jsonOk(
    { scope, entries, total: entries.length, limit },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
