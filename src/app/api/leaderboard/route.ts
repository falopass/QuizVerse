import { z } from 'zod';
import { PaginationSchema, jsonError, jsonOk, parseQuery } from '@/lib/api/query';
import { getLeaderboard } from '@/lib/data/public';
import { getWeeklyLeaderboard } from '@/lib/profile/weekly-ranking';
import { isMissingRpcFunction } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

const FRIENDS_PROFILE_COLUMNS = 'id, username, display_name, avatar_url, points, quizzes_played';
const MAX_FOLLOWS_SCAN = 5000;

interface FriendsProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  quizzes_played: number;
}

const LeaderboardQuerySchema = PaginationSchema.extend({
  /** `friends` incluye al jugador y a quienes sigue. Requiere sesión. */
  scope: z.enum(['global', 'friends']).default('global'),
  /** `week` solo aplica al scope global: partidas de los últimos 7 días. */
  window: z.enum(['all', 'week']).default('all'),
});

/** Forma pública de una entrada: los tres tableros responden igual (SOC-06). */
interface PublicEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  points: number;
  quizzesPlayed: number;
}

/**
 * GET /api/leaderboard?scope=global|friends&window=all|week&page=&limit=
 *
 * Ranking por puntos. `friends` se limita a la red de `user_follows` del
 * jugador autenticado (más él mismo) y devuelve 401 si no hay sesión.
 * `window=week` devuelve el ranking de actividad de los últimos 7 días.
 *
 * `page` pagina de verdad (SOC-06): cada tablero devuelve una página de
 * `limit` entradas y `hasMore`. Las entradas son planas e idénticas en los
 * tres scopes — sin `is_admin`, `is_verified` ni el perfil completo (SOC-09).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(LeaderboardQuerySchema, searchParams);
  if (!parsed.ok) return jsonError(400, 'invalid_query', parsed.fieldErrors);

  const { limit, page, scope, window: windowParam } = parsed.data;

  if (scope === 'global') {
    try {
      const result =
        windowParam === 'week'
          ? await getWeeklyLeaderboard(limit, page)
          : await getLeaderboard(limit, page);
      const entries: PublicEntry[] = result.entries.map((entry) => ({
        rank: entry.rank,
        id: entry.user.id,
        username: entry.user.username,
        displayName: entry.user.display_name,
        avatarUrl: entry.user.avatar_url,
        points: entry.points,
        quizzesPlayed: entry.quizzesPlayed,
      }));
      return jsonOk({
        scope,
        window: windowParam,
        page,
        limit,
        hasMore: result.hasMore,
        total: entries.length,
        entries,
      });
    } catch {
      return jsonError(503, 'leaderboard_unavailable');
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError(401, 'unauthorized');

  const from = (page - 1) * limit;
  let rows: FriendsProfileRow[] | null = null;

  const withRpc = supabase as typeof supabase & {
    rpc?: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: FriendsProfileRow[] | null;
      error: { code?: string; message?: string } | null;
    }>;
  };

  if (typeof withRpc.rpc === 'function') {
    const rpcResult = await withRpc.rpc('get_friends_leaderboard', {
      p_limit: limit + 1,
      p_offset: from,
    });
    if (!rpcResult.error && Array.isArray(rpcResult.data)) {
      rows = rpcResult.data;
    } else if (rpcResult.error && !isMissingRpcFunction(rpcResult.error)) {
      return jsonError(503, 'leaderboard_unavailable');
    }
  }

  if (rows === null) {
    const { data: follows, error: followsError } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .limit(MAX_FOLLOWS_SCAN);

    if (followsError) return jsonError(503, 'leaderboard_unavailable');

    const ids = [user.id, ...(follows ?? []).map((f) => f.following_id)];

    // Una fila de más para que `hasMore` sea exacto, igual que en el board global.
    const { data: profileRows, error } = await supabase
      .from('profiles')
      .select(FRIENDS_PROFILE_COLUMNS)
      .in('id', ids)
      .order('points', { ascending: false })
      .order('quizzes_played', { ascending: false })
      // Desempate único para que la paginación por offset no repita filas.
      .order('id', { ascending: true })
      .range(from, from + limit);

    if (error) return jsonError(503, 'leaderboard_unavailable');
    rows = (profileRows ?? []) as FriendsProfileRow[];
  }

  const pageRows = rows.slice(0, limit);
  const entries: PublicEntry[] = pageRows.map((row, index) => ({
    rank: from + index + 1,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    points: row.points,
    quizzesPlayed: row.quizzes_played,
  }));

  return jsonOk(
    {
      scope,
      page,
      limit,
      hasMore: (rows ?? []).length > limit,
      total: entries.length,
      entries,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
