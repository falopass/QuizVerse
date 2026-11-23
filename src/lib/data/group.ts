/**
 * Capa de datos del ranking de grupo (`?g=<token>`).
 *
 * Lecturas públicas: solo por token opaco y solo por los RPC de la migración
 * 021 (`get_quiz_group_by_token` / `get_quiz_group_entries`), que recortan a
 * campos públicos — sin listado de grupos ni PII más allá del apodo.
 *
 * Escrituras: nunca desde aquí por la puerta pública; el RLS lo impide y solo
 * la server action escribe con service role tras validar.
 *
 * Degradación: mientras la migración no existe (PGRST202/PGRST205) las
 * lecturas devuelven estado 'missing' en vez de reventar el resultado, que es
 * una URL compartible.
 */

import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isMissingRpcFunction, isMissingTable } from '@/lib/supabase/rpc';
import { rankGroupEntries, type GroupEntry, type QuizGroupInfo } from '@/lib/quiz/group';

/**
 * Orden determinista con desempate final por `gameSessionId`:
 * puntaje desc -> tiempo asc (null al final) -> llegada asc -> sesión asc.
 */
export function sortGroupEntriesDeterministically(entries: readonly GroupEntry[]): GroupEntry[] {
  const base = rankGroupEntries(entries);
  return base.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const timeA = a.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
    const byDate = a.createdAt.localeCompare(b.createdAt);
    if (byDate !== 0) return byDate;
    return a.gameSessionId.localeCompare(b.gameSessionId);
  });
}

/**
 * Compara si un nuevo intento supera al intento actual de un participante:
 * mayor puntaje gana; a igual puntaje, menor tiempo válido gana.
 */
export function isBetterGroupAttempt(
  candidate: { score: number; time_taken_seconds: number | null },
  current: { score: number; time_taken_seconds: number | null }
): boolean {
  if (candidate.score !== current.score) return candidate.score > current.score;
  const candidateTime = candidate.time_taken_seconds ?? Number.MAX_SAFE_INTEGER;
  const currentTime = current.time_taken_seconds ?? Number.MAX_SAFE_INTEGER;
  return candidateTime < currentTime;
}

type Client = Awaited<ReturnType<typeof createClient>>;
type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;

export type GroupReadState = 'ok' | 'missing' | 'error';

export interface GroupReadResult<T> {
  state: GroupReadState;
  value: T | null;
}

const ok = <T>(value: T | null): GroupReadResult<T> => ({ state: 'ok', value });
const missing = <T>(): GroupReadResult<T> => ({ state: 'missing', value: null });
const failed = <T>(): GroupReadResult<T> => ({ state: 'error', value: null });

function isAbsent(error: { code?: string; message?: string }): boolean {
  return isMissingRpcFunction(error) || isMissingTable(error);
}

/** Apodo sugerido del perfil: `display_name` si existe; si no, `username`. */
export function pickProfileNickname(
  profile: { username?: string | null; display_name?: string | null } | null
): string | undefined {
  return profile?.display_name?.trim() || profile?.username?.trim() || undefined;
}

/** Grupo público por token; `null` con state 'ok' = token sin grupo. */
export async function fetchGroupByToken(
  supabase: Client,
  token: string
): Promise<GroupReadResult<QuizGroupInfo>> {
  const { data, error } = await supabase
    .rpc('get_quiz_group_by_token', { p_token: token })
    .maybeSingle();

  if (error) return isAbsent(error) ? missing() : failed();
  if (!data) return ok<QuizGroupInfo>(null);
  return ok({
    id: data.id,
    quizId: data.quiz_id,
    token,
    creatorNickname: data.creator_nickname,
    playerCount: data.entries_count,
    createdAt: data.created_at,
  });
}

/**
 * Ranking del grupo por token, ya ordenado. `sessionId` pide también la fila
 * propia aunque quede fuera del top 100 del RPC: sin ella el resaltado y el
 * "ya entraste" desaparecerían en grupos grandes.
 */
export async function fetchGroupEntries(
  supabase: Client,
  token: string,
  sessionId?: string
): Promise<GroupReadResult<GroupEntry[]>> {
  const { data, error } = await supabase.rpc('get_quiz_group_entries', {
    p_token: token,
    p_session: sessionId ?? null,
  });

  if (error) return isAbsent(error) ? missing() : failed();
  return ok(
    sortGroupEntriesDeterministically(
      (data ?? []).map((row) => ({
        nickname: row.nickname,
        score: row.score,
        maxScore: row.max_score,
        timeTakenSeconds: row.time_taken_seconds,
        gameSessionId: row.game_session_id,
        createdAt: row.created_at,
        position: row.position,
      }))
    )
  );
}

/**
 * ¿Esta partida ya entró a un grupo? Solo service role: RLS cierra la tabla a
 * lecturas públicas. Sirve para mostrar el ranking al volver al resultado sin
 * necesitar el token en la URL. Sin service key devuelve null (no aplica).
 */
export async function fetchGroupForSession(gameSessionId: string): Promise<QuizGroupInfo | null> {
  const service = createServiceClient();
  if (!service) return null;

  const { data: entry, error } = await service
    .from('quiz_group_entries')
    .select('group_id')
    .eq('game_session_id', gameSessionId)
    .limit(1)
    .maybeSingle();

  if (error || !entry) return null;

  const { data: group, error: groupError } = await service
    .from('quiz_groups')
    .select('id, quiz_id, token, creator_nickname, created_at')
    .eq('id', entry.group_id)
    .maybeSingle();

  if (groupError || !group) return null;
  const playerCount = await groupPlayerCount(service, group.id);
  return {
    id: group.id,
    quizId: group.quiz_id,
    token: group.token,
    creatorNickname: group.creator_nickname,
    playerCount,
    createdAt: group.created_at,
  };
}

/** Conteo real de entradas del grupo (la lectura pública recorta a 100). */
async function groupPlayerCount(service: ServiceClient, groupId: string): Promise<number> {
  const { count, error } = await service
    .from('quiz_group_entries')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);
  return error ? 0 : (count ?? 0);
}

/** Sesión propietaria del resultado: las columnas que el grupo necesita. */
export interface GroupCreatorSession {
  id: string;
  quiz_id: string;
  player_id: string | null;
  /** Attempt firmado que creó la partida (migración 020): prueba titularidad. */
  attempt_id: string | null;
  score: number;
  max_score: number;
  time_taken_seconds: number | null;
}

export async function fetchSessionForGroup(
  supabase: Client | ServiceClient,
  shareToken: string
): Promise<GroupReadResult<GroupCreatorSession>> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, quiz_id, player_id, attempt_id, score, max_score, time_taken_seconds')
    .eq('share_token', shareToken)
    .maybeSingle();

  if (error) return failed();
  return ok(data);
}

/**
 * Grupo ya creado por este creador en este quiz — reuso del botón "retar":
 * por usuario si hay sesión iniciada, si no por sesión de partida.
 */
export async function fetchExistingGroup(
  service: ServiceClient,
  quizId: string,
  sessionId: string,
  userId: string | null
): Promise<GroupReadResult<QuizGroupInfo>> {
  const query = service
    .from('quiz_groups')
    .select('id, quiz_id, token, creator_nickname, created_at')
    .eq('quiz_id', quizId)
    .limit(1);

  const { data, error } = userId
    ? await query.eq('creator_user_id', userId).maybeSingle()
    : await query.is('creator_user_id', null).eq('creator_session_id', sessionId).maybeSingle();

  if (error) return isAbsent(error) ? missing() : failed();
  if (!data) return ok<QuizGroupInfo>(null);
  const playerCount = await groupPlayerCount(service, data.id);
  return ok({
    id: data.id,
    quizId: data.quiz_id,
    token: data.token,
    creatorNickname: data.creator_nickname,
    playerCount,
    createdAt: data.created_at,
  });
}

/** Resultado del insert del grupo: `conflict` = otra creación ganó la carrera. */
export interface GroupInsertResult {
  state: 'ok' | 'missing' | 'error' | 'conflict';
  value: QuizGroupInfo | null;
}

/** Inserta el grupo; el token lo genera la DB (20 hex, no adivinable). */
export async function insertGroup(
  service: ServiceClient,
  row: {
    quiz_id: string;
    creator_session_id: string;
    creator_user_id: string | null;
    creator_nickname: string;
  }
): Promise<GroupInsertResult> {
  const { data, error } = await service
    .from('quiz_groups')
    .insert(row)
    .select('id, quiz_id, token, creator_nickname, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return { state: 'conflict', value: null };
    return isAbsent(error) ? missing() : failed();
  }
  return ok({
    id: data.id,
    quizId: data.quiz_id,
    token: data.token,
    creatorNickname: data.creator_nickname,
    playerCount: 0,
    createdAt: data.created_at,
  });
}

/**
 * ¿La sesión ya tiene entrada en el grupo? Clave de la idempotencia del join:
 * reintentos devuelven "ya estaba" sin duplicar fila.
 */
export async function fetchGroupEntry(
  service: ServiceClient,
  groupId: string,
  gameSessionId: string
): Promise<GroupReadResult<GroupEntry>> {
  const { data, error } = await service
    .from('quiz_group_entries')
    .select('nickname, score, max_score, time_taken_seconds, game_session_id, created_at')
    .eq('group_id', groupId)
    .eq('game_session_id', gameSessionId)
    .maybeSingle();

  if (error) return isAbsent(error) ? missing() : failed();
  if (!data) return ok<GroupEntry>(null);
  return ok({
    nickname: data.nickname,
    score: data.score,
    maxScore: data.max_score,
    timeTakenSeconds: data.time_taken_seconds,
    gameSessionId: data.game_session_id,
    createdAt: data.created_at,
  });
}

/** Inserta la entrada; puntaje/tiempo ya vienen de la sesión del servidor. */
export async function insertGroupEntry(
  service: ServiceClient,
  row: {
    group_id: string;
    nickname: string;
    score: number;
    max_score: number;
    time_taken_seconds: number | null;
    game_session_id: string;
  }
): Promise<'ok' | 'conflict' | 'missing' | 'error'> {
  const { error } = await service.from('quiz_group_entries').insert(row);
  if (!error) return 'ok';
  if (error.code === '23505') return 'conflict';
  return isAbsent(error) ? 'missing' : 'error';
}

export interface ReconcileParticipantResult {
  state: 'ok' | 'missing' | 'error';
  action: 'insert_new' | 'keep_existing' | 'replaced';
  entry: GroupEntry | null;
}

/**
 * Mantiene un único mejor intento elegible por participante autenticado en el
 * grupo, compatible con la migración 027 aplicada y sin aplicar.
 *
 * - Si el usuario no tenía entradas previas en este grupo, indica `insert_new`.
 * - Si ya tenía una entrada igual o mejor, indica `keep_existing` y la devuelve.
 * - Si el nuevo intento supera a su marca anterior (mayor puntaje o menor
 *   tiempo a igual puntaje), actualiza la fila existente y devuelve `replaced`.
 */
export async function reconcileParticipantGroupEntry(
  service: ServiceClient,
  groupId: string,
  session: GroupCreatorSession,
  nickname: string
): Promise<ReconcileParticipantResult> {
  if (!session.player_id) {
    return { state: 'ok', action: 'insert_new', entry: null };
  }

  const { data: groupEntries, error: entriesError } = await service
    .from('quiz_group_entries')
    .select('id, nickname, score, max_score, time_taken_seconds, game_session_id, created_at')
    .eq('group_id', groupId);

  if (entriesError) {
    return {
      state: isAbsent(entriesError) ? 'missing' : 'error',
      action: 'insert_new',
      entry: null,
    };
  }

  const rows = (groupEntries ?? []) as Array<{
    id: string;
    nickname: string;
    score: number;
    max_score: number;
    time_taken_seconds: number | null;
    game_session_id: string;
    created_at: string;
  }>;
  if (rows.length === 0) {
    return { state: 'ok', action: 'insert_new', entry: null };
  }

  const sessionIds = rows.map((row) => row.game_session_id);
  const { data: ownedSessions, error: sessionsError } = await service
    .from('game_sessions')
    .select('id, player_id')
    .eq('player_id', session.player_id);

  if (sessionsError) {
    return { state: 'error', action: 'insert_new', entry: null };
  }

  const ownedSet = new Set(
    ((ownedSessions ?? []) as Array<{ id: string }>)
      .map((item) => item.id)
      .filter((id) => sessionIds.includes(id))
  );
  const participantEntries = rows.filter((row) => ownedSet.has(row.game_session_id));
  if (participantEntries.length === 0) {
    return { state: 'ok', action: 'insert_new', entry: null };
  }

  // Elige la mejor marca previa del participante si hubiera históricos múltiples.
  participantEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const timeA = a.time_taken_seconds ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.time_taken_seconds ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
    return (
      a.created_at.localeCompare(b.created_at) || a.game_session_id.localeCompare(b.game_session_id)
    );
  });
  const bestPrevious = participantEntries[0];

  if (!isBetterGroupAttempt(session, bestPrevious)) {
    return {
      state: 'ok',
      action: 'keep_existing',
      entry: {
        nickname: bestPrevious.nickname,
        score: bestPrevious.score,
        maxScore: bestPrevious.max_score,
        timeTakenSeconds: bestPrevious.time_taken_seconds,
        gameSessionId: bestPrevious.game_session_id,
        createdAt: bestPrevious.created_at,
      },
    };
  }

  const { error: updateError } = await service
    .from('quiz_group_entries')
    .update({
      nickname,
      score: session.score,
      max_score: session.max_score,
      time_taken_seconds: session.time_taken_seconds,
      game_session_id: session.id,
    })
    .eq('id', bestPrevious.id);

  if (updateError) {
    return {
      state: isAbsent(updateError) ? 'missing' : 'error',
      action: 'insert_new',
      entry: null,
    };
  }

  return {
    state: 'ok',
    action: 'replaced',
    entry: {
      nickname,
      score: session.score,
      maxScore: session.max_score,
      timeTakenSeconds: session.time_taken_seconds,
      gameSessionId: session.id,
      createdAt: bestPrevious.created_at,
    },
  };
}
