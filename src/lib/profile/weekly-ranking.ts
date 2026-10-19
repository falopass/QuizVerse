import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { normalizeProfile, type ProfileRow } from '@/lib/data/normalizers';
import { pointsFor } from '@/lib/quiz/submission';
import type { LeaderboardEntry } from '@/lib/data/public';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionRow {
  player_id: string | null;
  score: number;
  max_score: number;
}

/**
 * Ranking semanal del leaderboard (`?tab=semanal`).
 *
 * Cuenta las partidas terminadas en los últimos 7 días (`game_sessions` con
 * `player_id`), las agrega por jugador y resuelve los perfiles del top con una
 * sola consulta `.in()`. Devuelve la misma forma que `getLeaderboard`:
 *
 * - `quizzesPlayed` = partidas de la semana (la métrica del ranking: la
 *   pestaña responde «quién juega esta semana»).
 * - `points` = puntos que el trigger `award_quiz_points` otorgó por esas
 *   partidas (`pointsFor`: 10 por terminar, +25 por partida perfecta).
 *   Desempata a quienes jugaron lo mismo.
 */
export async function getWeeklyLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - WEEK_MS).toISOString();

    // PostgREST recorta a su `max-rows` por consulta; con el volumen semanal
    // actual sobra para el top. Si la semana supera ese tope, el ranking se
    // vuelve aproximado: migrar a una vista SQL agregada.
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('player_id, score, max_score')
      .gte('completed_at', since)
      .not('player_id', 'is', null);

    if (sessionsError || !sessions) {
      throw sessionsError ?? new Error('Could not fetch weekly sessions');
    }

    const totals = new Map<string, { played: number; points: number }>();
    for (const session of sessions as SessionRow[]) {
      if (!session.player_id) continue;
      const total = totals.get(session.player_id) ?? { played: 0, points: 0 };
      total.played += 1;
      total.points += pointsFor(session.max_score > 0 && session.score === session.max_score);
      totals.set(session.player_id, total);
    }

    const top = [...totals.entries()]
      .sort((a, b) => b[1].played - a[1].played || b[1].points - a[1].points)
      .slice(0, limit);
    if (top.length === 0) return [];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in(
        'id',
        top.map(([id]) => id)
      );

    if (profilesError) {
      throw profilesError;
    }

    const profilesById = new Map(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

    const entries: LeaderboardEntry[] = [];
    for (const [id, total] of top) {
      const row = profilesById.get(id);
      if (!row) continue;
      entries.push({
        rank: entries.length + 1,
        user: normalizeProfile(row),
        points: total.points,
        quizzesPlayed: total.played,
      });
    }
    return entries;
  } catch {
    return [];
  }
}
