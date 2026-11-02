import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { isMissingRpcFunction } from '@/lib/supabase/rpc';
import { normalizeProfile, type ProfileRow } from '@/lib/data/normalizers';
import { pointsFor } from '@/lib/quiz/submission';
import type { LeaderboardEntry, LeaderboardResult } from '@/lib/data/public';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
// Válvula contra un bucle infinito; si la semana supera este volumen el
// ranking queda aproximado y conviene una vista/RPC agregada (migración).
const MAX_SESSION_ROWS = 50_000;

interface SessionRow {
  player_id: string | null;
  score: number;
  max_score: number;
}

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Camino anterior a la migración 013: la policy vieja permitía barrer todas
 * las sesiones. PostgREST recorta cada respuesta a su `max-rows`, así que hay
 * que paginar o el ranking se arma con un lote truncado y jugadores
 * desaparecen. `id` ordena de forma determinista para que las páginas no se
 * pisen.
 */
async function collectSessionTotals(
  supabase: Client,
  since: string,
  totals: Map<string, { played: number; points: number }>
): Promise<void> {
  for (let from = 0; from < MAX_SESSION_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('player_id, score, max_score')
      .gte('completed_at', since)
      .not('player_id', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) {
      throw error ?? new Error('Could not fetch weekly sessions');
    }
    for (const session of data as SessionRow[]) {
      if (!session.player_id) continue;
      const total = totals.get(session.player_id) ?? { played: 0, points: 0 };
      total.played += 1;
      total.points += pointsFor(session.max_score > 0 && session.score === session.max_score);
      totals.set(session.player_id, total);
    }
    if (data.length < PAGE_SIZE) break;
  }
}

/**
 * Partidas por jugador en la ventana.
 *
 * Con la migración 013 la lectura ajena pasa por `get_weekly_session_totals`,
 * que agrega en SQL (una fila por jugador), fija la ventana a 7 días y ya
 * devuelve los totales ordenados y recortados a `limit` — así un recorte de
 * `max-rows` de PostgREST no puede esconder líderes. Sin la migración se
 * barre la tabla como siempre. Cualquier otro error del RPC se propaga igual
 * que el de la query.
 */
async function loadWeeklyTotals(
  supabase: Client,
  since: string,
  limit: number
): Promise<Map<string, { played: number; points: number }>> {
  const totals = new Map<string, { played: number; points: number }>();
  const { data, error } = await supabase.rpc('get_weekly_session_totals', { p_limit: limit });

  if (!error) {
    for (const row of data) {
      totals.set(row.player_id, {
        played: row.played,
        // 10 por partida + 25 por perfecta: la fórmula del trigger, sin
        // duplicar constantes (pointsFor es la fuente única).
        points: row.played * pointsFor(false) + row.perfect * (pointsFor(true) - pointsFor(false)),
      });
    }
    return totals;
  }

  if (!isMissingRpcFunction(error)) throw error;

  await collectSessionTotals(supabase, since, totals);
  return totals;
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
 *
 * Lanza si falla cualquiera de las dos consultas: la página muestra un aviso
 * con reintento y la API responde 503, nunca un ranking vacío falso.
 *
 * `page` pagina el tablero (SOC-06): se pide una fila de más sobre la página
 * para que `hasMore` sea exacto. El RPC clampa su tope a 100 (migración 019),
 * así que las páginas que exceden ese tope simplemente salen vacías.
 */
export async function getWeeklyLeaderboard(limit = 50, page = 1): Promise<LeaderboardResult> {
  const supabase = await createClient();
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const safePage = Number.isSafeInteger(page) && page >= 1 ? page : 1;
  const cutoff = safePage * limit;

  const totals = await loadWeeklyTotals(supabase, since, cutoff + 1);

  const top = [...totals.entries()]
    .sort((a, b) => b[1].played - a[1].played || b[1].points - a[1].points)
    .slice(0, cutoff + 1);
  const window = top.slice((safePage - 1) * limit, cutoff);
  if (window.length === 0) return { entries: [], hasMore: top.length > cutoff };

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in(
      'id',
      window.map(([id]) => id)
    );

  if (profilesError) {
    throw profilesError;
  }

  const profilesById = new Map(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  const entries: LeaderboardEntry[] = [];
  for (const [id, total] of window) {
    const row = profilesById.get(id);
    if (!row) continue;
    entries.push({
      rank: (safePage - 1) * limit + entries.length + 1,
      user: normalizeProfile(row),
      points: total.points,
      quizzesPlayed: total.played,
    });
  }
  return { entries, hasMore: top.length > cutoff };
}

/**
 * Puesto propio en el ranking semanal, aunque quede fuera del top mostrado
 * (SOC-14). Lo calcula `get_weekly_rank` (migración 019) con el mismo orden
 * que el tablero. Devuelve null cuando el RPC no existe todavía o el jugador
 * no tiene partidas autenticadas en la ventana — la página muestra el aviso
 * genérico de «fuera del top». Otros errores se propagan igual que el board.
 */
export async function getWeeklyRank(userId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_weekly_rank', { p_user_id: userId });

  if (error) {
    if (isMissingRpcFunction(error)) return null;
    throw error;
  }

  return typeof data === 'number' ? data : null;
}
