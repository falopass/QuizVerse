/**
 * Estadísticas del sitio para el panel /admin/estadisticas (solo lectura).
 *
 * Las consultas corren con el cliente service role: `game_sessions` solo es
 * legible por el propio jugador vía RLS (migración 013), así que el cliente
 * SSR del admin no vería más que sus partidas. El cliente nunca sale del
 * servidor y el payload agregado no lleva PII: ni correos, ni usernames, ni
 * player_id (se usa solo para distinguir registrado de anónimo y se reduce a
 * conteos antes de salir de aquí).
 *
 * Sin migración: todo se resuelve con consultas PostgREST normales, con
 * paginación explícita porque `max-rows` de PostgREST recorta en silencio.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type StatsClient = Pick<SupabaseClient<Database>, 'from'>;

export const STATS_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
// Válvulas contra bucles infinitos; al superarse, el panel marca la sección
// como truncada y conviene una vista/RPC agregada (migración nueva).
const CATALOG_ROW_CAP = 20_000;
const SESSION_ROW_CAP = 100_000;
const CATEGORY_LIMIT = 500;
export const TOP_QUIZ_LIMIT = 20;

export interface DailySeriesPoint {
  /** Día UTC en formato YYYY-MM-DD. */
  date: string;
  total: number;
  registered: number;
  anonymous: number;
}

export interface GroupCount {
  /** Clave de agrupación; null = sin categoría. */
  key: string | null;
  count: number;
  /** Proporción 0..1 sobre el total del grupo. */
  share: number;
}

export interface TopQuiz {
  title: string;
  slug: string;
  language: string;
  value: number;
}

export interface AdminStats {
  generatedAt: string;
  catalog: {
    published: number;
    truncated: boolean;
    byLanguage: GroupCount[];
    byType: GroupCount[];
    byCategory: GroupCount[];
  };
  sessions: {
    daily: DailySeriesPoint[];
    windowDays: number;
    windowTotal: number;
    windowRegistered: number;
    windowAnonymous: number;
    truncated: boolean;
    allTimeTotal: number;
    allTimeRegistered: number;
    allTimeAnonymous: number;
  };
  top: {
    byPlays: TopQuiz[];
    byShares: TopQuiz[];
    byLikes: TopQuiz[];
  };
  accounts: {
    profilesTotal: number;
    profilesNew7d: number;
    profilesNew30d: number;
  };
  community: {
    commentsTotal: number;
    pendingQuizReports: number;
    /** null cuando la migración 017 aún no está aplicada. */
    pendingCommentReports: number | null;
  };
}

interface SessionLite {
  completed_at: string;
  player_id: string | null;
}

/** Primer día (UTC) de la ventana de `days` días que termina hoy. */
export function utcWindowStart(now: Date, days: number): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

/** Proporción 0..1; 0 cuando el total no es positivo. */
export function shareOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

/**
 * Serie diaria de partidas con los huecos rellenos a 0. Los días se agrupan
 * en UTC (clave estable y sin depender del huso del servidor); las sesiones
 * fuera de la ventana se ignoran al emitir solo los `days` últimos días.
 */
export function buildDailySeries(
  sessions: SessionLite[],
  days: number,
  now: Date
): DailySeriesPoint[] {
  const counts = new Map<string, { registered: number; anonymous: number }>();
  for (const session of sessions) {
    const day = new Date(session.completed_at);
    if (Number.isNaN(day.getTime())) continue;
    const key = day.toISOString().slice(0, 10);
    const bucket = counts.get(key) ?? { registered: 0, anonymous: 0 };
    if (session.player_id) bucket.registered += 1;
    else bucket.anonymous += 1;
    counts.set(key, bucket);
  }

  const start = utcWindowStart(now, days);
  const series: DailySeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const bucket = counts.get(key);
    const registered = bucket?.registered ?? 0;
    const anonymous = bucket?.anonymous ?? 0;
    series.push({ date: key, total: registered + anonymous, registered, anonymous });
  }
  return series;
}

/**
 * Conteos por clave, ordenados de mayor a menor; en empate, orden de clave
 * ascendente con `null` (sin categoría) al final. `share` es la proporción
 * sobre el total de filas recibidas.
 */
export function groupCounts(keys: (string | null | undefined)[]): GroupCount[] {
  const counts = new Map<string | null, number>();
  for (const key of keys) {
    const normalized = key ?? null;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: shareOf(count, keys.length) }))
    .sort(
      (a, b) =>
        b.count - a.count || (a.key === null ? 1 : b.key === null ? -1 : a.key < b.key ? -1 : 1)
    );
}

/** Top por métrica: mayor primero, título ascendente como desempate. */
export function topQuizzes(rows: TopQuiz[], limit = TOP_QUIZ_LIMIT): TopQuiz[] {
  return [...rows]
    .sort((a, b) => b.value - a.value || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** PostgREST/SQL cuando la tabla todavía no existe (migración sin aplicar). */
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table|relation .* does not exist/i.test(error.message ?? '')
  );
}

interface PageResult<Row> {
  data: Row[] | null;
  error: { code?: string; message?: string } | null;
}

/**
 * Barre la consulta página a página: PostgREST recorta cada respuesta a su
 * `max-rows`, y un lote truncado inventaría cifras. `cap` es la válvula; al
 * alcanzarse el resultado se marca `truncated` en vez de seguir eternamente.
 */
async function collectPages<Row>(
  cap: number,
  page: (from: number, to: number) => PromiseLike<PageResult<Row>>
): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = [];
  for (let from = 0; from < cap; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

interface CountResult {
  count: number | null;
  error: { code?: string; message?: string } | null;
}

/** COUNT exacto vía `head: true`: no viaja ninguna fila por el cable. */
async function mustCount(query: PromiseLike<CountResult>): Promise<number> {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Igual que mustCount pero devuelve null cuando la tabla aún no existe. */
async function countOrMissing(query: PromiseLike<CountResult>): Promise<number | null> {
  const { count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return count ?? 0;
}

interface CatalogRow {
  language: string;
  quiz_type: string;
  category_id: string | null;
}

interface TopQuizRow {
  title: string;
  slug: string;
  language: string;
  value: number;
}

/**
 * Reúne todas las cifras del panel. Solo columnas agregables: nada de correos,
 * usernames ni ids de usuario en el resultado. Lanza si falla cualquier
 * consulta (la página muestra el estado de error, nunca números a medias).
 */
export async function loadAdminStats(client: StatsClient, now = new Date()): Promise<AdminStats> {
  const windowStart = utcWindowStart(now, STATS_WINDOW_DAYS);
  const newProfiles7dSince = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const newProfiles30dSince = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const topQuery = (metric: 'plays_count' | 'shares_count' | 'likes_count') =>
    client
      .from('quizzes')
      .select(`title, slug, language, value:${metric}`)
      .eq('status', 'published')
      .order(metric, { ascending: false })
      .limit(TOP_QUIZ_LIMIT)
      .then((res) => {
        if (res.error) throw res.error;
        return topQuizzes((res.data ?? []) as TopQuizRow[]);
      });

  const [
    catalog,
    categories,
    windowSessions,
    allTimeTotal,
    allTimeRegistered,
    byPlays,
    byShares,
    byLikes,
    profilesTotal,
    profilesNew7d,
    profilesNew30d,
    commentsTotal,
    pendingQuizReports,
    pendingCommentReports,
  ] = await Promise.all([
    collectPages<CatalogRow>(CATALOG_ROW_CAP, (from, to) =>
      client
        .from('quizzes')
        .select('language, quiz_type, category_id')
        .eq('status', 'published')
        .order('id')
        .range(from, to)
    ),
    client
      .from('categories')
      .select('id, name')
      .order('sort_order')
      .limit(CATEGORY_LIMIT)
      .then((res) => {
        if (res.error) throw res.error;
        return res.data ?? [];
      }),
    collectPages<SessionLite>(SESSION_ROW_CAP, (from, to) =>
      client
        .from('game_sessions')
        .select('completed_at, player_id')
        .gte('completed_at', windowStart.toISOString())
        .order('id')
        .range(from, to)
    ),
    mustCount(client.from('game_sessions').select('id', { count: 'exact', head: true })),
    mustCount(
      client
        .from('game_sessions')
        .select('id', { count: 'exact', head: true })
        .not('player_id', 'is', null)
    ),
    topQuery('plays_count'),
    topQuery('shares_count'),
    topQuery('likes_count'),
    mustCount(client.from('profiles').select('id', { count: 'exact', head: true })),
    mustCount(
      client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', newProfiles7dSince)
    ),
    mustCount(
      client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', newProfiles30dSince)
    ),
    mustCount(client.from('quiz_comments').select('id', { count: 'exact', head: true })),
    mustCount(
      client.from('quiz_reports').select('id', { count: 'exact', head: true }).eq('resolved', false)
    ),
    countOrMissing(
      client
        .from('comment_reports')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false)
    ),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const daily = buildDailySeries(windowSessions.rows, STATS_WINDOW_DAYS, now);
  const windowRegistered = daily.reduce((sum, day) => sum + day.registered, 0);
  const windowAnonymous = daily.reduce((sum, day) => sum + day.anonymous, 0);

  return {
    generatedAt: now.toISOString(),
    catalog: {
      published: catalog.rows.length,
      truncated: catalog.truncated,
      byLanguage: groupCounts(catalog.rows.map((row) => row.language)),
      byType: groupCounts(catalog.rows.map((row) => row.quiz_type)),
      byCategory: groupCounts(
        catalog.rows.map((row) =>
          row.category_id ? (categoryNames.get(row.category_id) ?? null) : null
        )
      ),
    },
    sessions: {
      daily,
      windowDays: STATS_WINDOW_DAYS,
      windowTotal: windowRegistered + windowAnonymous,
      windowRegistered,
      windowAnonymous,
      truncated: windowSessions.truncated,
      allTimeTotal,
      allTimeRegistered,
      allTimeAnonymous: Math.max(0, allTimeTotal - allTimeRegistered),
    },
    top: { byPlays, byShares, byLikes },
    accounts: {
      profilesTotal,
      profilesNew7d,
      profilesNew30d,
    },
    community: {
      commentsTotal,
      pendingQuizReports,
      pendingCommentReports,
    },
  };
}
