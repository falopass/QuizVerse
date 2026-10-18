import { z } from 'zod';
import { PaginationSchema, jsonError, jsonOk, parseQuery } from '@/lib/api/query';
import { getLeaderboard } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

const LeaderboardQuerySchema = PaginationSchema.extend({
  /** `friends` incluye al jugador y a quienes sigue. Requiere sesión. */
  scope: z.enum(['global', 'friends']).default('global'),
});

interface LeaderboardRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  quizzes_played: number;
}

/**
 * `user_follows` existe en la base (migracion 006) pero no esta en
 * `src/types/database.ts`. Hasta regenerar tipos, esta interfaz estrecha es la
 * unica superficie que necesita el ranking de amigos.
 */
interface FollowsTable {
  from(table: 'user_follows'): {
    select(columns: string): {
      eq(
        column: string,
        value: string
      ): Promise<{ data: Array<{ following_id: string }> | null; error: unknown }>;
    };
  };
}
/**
 * GET /api/leaderboard?scope=global|friends&limit=
 *
 * Ranking por puntos. `friends` se limita a la red de `user_follows` del
 * jugador autenticado (más él mismo) y devuelve 401 si no hay sesión.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(LeaderboardQuerySchema, searchParams);
  if (!parsed.ok) return jsonError(400, 'invalid_query', parsed.fieldErrors);

  const { limit, scope } = parsed.data;

  if (scope === 'global') {
    try {
      const entries = await getLeaderboard(limit);
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

  const { data: follows, error: followsError } = await (supabase as unknown as FollowsTable)
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (followsError) return jsonError(503, 'leaderboard_unavailable');

  const ids = [
    user.id,
    ...((follows ?? []) as Array<{ following_id: string }>).map((f) => f.following_id),
  ];

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids)
    .order('points', { ascending: false })
    .limit(limit);

  if (error) return jsonError(503, 'leaderboard_unavailable');

  const entries = ((rows ?? []) as unknown as LeaderboardRow[]).map((row, index) => ({
    rank: index + 1,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    points: row.points,
    quizzesPlayed: row.quizzes_played,
  }));

  return jsonOk({ scope, entries, total: entries.length, limit });
}
