'use server';

/**
 * Ranking de grupo por enlace (`?g=<token>`).
 *
 * Orquestación fina: rate limit por IP → validación → dominio/capa de datos.
 * El puntaje de una entrada se copia de `game_sessions` ya puntuada por el
 * servidor (`scoreSubmission` en submitQuizResult): el cliente aporta apodo y
 * tokens, nunca el puntaje. Las escrituras usan service role porque RLS
 * cierra ambas tablas a la puerta pública; la lectura es por RPC con token.
 *
 * Degradación: hasta que la migración 021 se aplique, las lecturas/escrituras
 * responden `unavailable` y la UI muestra "no disponible" sin romper el
 * resultado compartido.
 */

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import {
  actionFailure,
  unexpectedFailure,
  zodMessage,
  type ActionFailure,
  type ActionResult,
} from '@/lib/actions/types';
import { isShareToken } from '@/lib/quiz/challenge';
import { isGroupToken, type GroupEntry, type QuizGroupInfo } from '@/lib/quiz/group';
import { attemptsAvailable, verifyQuizAttempt, warnAttemptsInactive } from '@/lib/quiz/attempt';
import { isNicknameAllowed, type NicknameDenyReason } from '@/lib/moderation/nickname';
import {
  fetchExistingGroup,
  fetchGroupByToken,
  fetchGroupEntries,
  fetchGroupEntry,
  fetchSessionForGroup,
  insertGroup,
  insertGroupEntry,
  type GroupCreatorSession,
} from '@/lib/data/group';

/** 20/min por IP: crea grupos y une entradas (escrituras). */
const groupLimiter = createRateLimiter('quiz-group', 20, 60, 'open');
/** 60/min por IP: consulta pública del ranking, con conteo real (`record`). */
const groupReadLimiter = createRateLimiter('quiz-group-read', 60, 60, 'open');

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

const groupTokenSchema = z.string().refine(isGroupToken, { message: 'Invalid group token.' });
const shareTokenSchema = z.string().refine(isShareToken, { message: 'Invalid session token.' });
/** Texto libre acotado; la forma concreta la decide el filtro de apodos. */
const rawNicknameSchema = z.string().min(1).max(80);
/** Token attempt firmado (v1.<payload>.<firma>); acotado contra abuso. */
const attemptSchema = z.string().min(1).max(1024).optional();

const UNAVAILABLE = 'The group ranking is not available yet.';

function unavailable(scope: string): ActionFailure {
  console.warn(`[action:${scope}] ranking de grupo no disponible: falta la migración 021`);
  return actionFailure('unavailable', UNAVAILABLE);
}

function nicknameFailure(reason: NicknameDenyReason): ActionFailure {
  // El motivo viaja como token estable; la UI lo traduce a es/en.
  return actionFailure('invalid_input', `nickname_${reason}`);
}

function nicknameOrFailure(raw: string): { value?: string; failure?: ActionFailure } {
  const verdict = isNicknameAllowed(raw);
  if (verdict.ok) return { value: verdict.value };
  return { failure: nicknameFailure(verdict.reason) };
}

/**
 * Titularidad de la partida. El `shareToken` solo ubica la sesión — viaja en
 * todos los resultados compartidos y no prueba nada por sí solo. Las pruebas
 * reales, en orden:
 *
 * 1. Usuario autenticado dueño de la partida (`player_id` = auth.uid()).
 * 2. El attempt firmado de la partida: quien jugó lo tiene en memoria (nunca
 *    va en un enlace) y debe coincidir con `game_sessions.attempt_id` y con
 *    el quiz de la sesión.
 *
 * Sin secreto de attempts el servidor ya corre en modo degradado (como en el
 * reveal/envío): se permite solo partidas previas a los attempts
 * (`attempt_id` NULL); las demás no pueden probarse y se rechazan.
 */
async function ownsGameSession(
  session: GroupCreatorSession,
  attemptToken: string | undefined,
  userId: string | null
): Promise<boolean> {
  if (userId && session.player_id === userId) return true;
  if (!attemptsAvailable()) {
    warnAttemptsInactive();
    return session.attempt_id === null;
  }
  const check = await verifyQuizAttempt(attemptToken, session.quiz_id);
  return check.ok && check.attempt.attemptId === session.attempt_id;
}

const NOT_OWNED = 'Only the owner of this game session can add it to a group.';

/**
 * Crea (o reutiliza) el grupo del que comparte el resultado. La titularidad
 * de la sesión se prueba con el attempt firmado o con la sesión de auth (ver
 * `ownsGameSession`); la sesión aporta quiz y creador, y el apodo del creador
 * se modera igual que el de cualquier entrada.
 */
export async function createQuizGroup(input: {
  shareToken: string;
  nickname: string;
  attempt?: string;
}): Promise<ActionResult<{ groupToken: string; group: QuizGroupInfo; reused: boolean }>> {
  const { allowed } = await groupLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many requests. Try again later.');

  const parsed = z
    .object({ shareToken: shareTokenSchema, nickname: rawNicknameSchema, attempt: attemptSchema })
    .safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { value: nickname, failure } = nicknameOrFailure(parsed.data.nickname);
  if (failure) return failure;

  const supabase = await createClient();
  const service = createServiceClient();
  if (!service) return actionFailure('unavailable', UNAVAILABLE);

  const sessionRead = await fetchSessionForGroup(service, parsed.data.shareToken);
  if (sessionRead.state === 'error') {
    return unexpectedFailure('createQuizGroup.session', 'session lookup failed');
  }
  const session = sessionRead.value;
  if (!session) return actionFailure('not_found', 'Session not found.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await ownsGameSession(session, parsed.data.attempt, user?.id ?? null))) {
    return actionFailure('unauthorized', NOT_OWNED);
  }

  const existing = await fetchExistingGroup(
    service,
    session.quiz_id,
    session.id,
    session.player_id
  );
  if (existing.state === 'missing') return unavailable('createQuizGroup');
  if (existing.state === 'error') {
    return unexpectedFailure('createQuizGroup.lookup', 'group lookup failed');
  }
  if (existing.value) {
    return { success: true, groupToken: existing.value.token, group: existing.value, reused: true };
  }

  const created = await insertGroup(service, {
    quiz_id: session.quiz_id,
    creator_session_id: session.id,
    creator_user_id: session.player_id,
    creator_nickname: nickname!,
  });
  if (created.state === 'missing') return unavailable('createQuizGroup');
  if (created.state === 'conflict') {
    // Dos creaciones simultáneas compitieron por el índice único: la otra ya
    // ganó; se devuelve ese grupo como reuse, no un error.
    const winner = await fetchExistingGroup(
      service,
      session.quiz_id,
      session.id,
      session.player_id
    );
    if (winner.value) {
      return { success: true, groupToken: winner.value.token, group: winner.value, reused: true };
    }
    return unexpectedFailure('createQuizGroup.conflict', 'conflict without group');
  }
  if (created.state === 'error' || !created.value) {
    return unexpectedFailure('createQuizGroup.insert', 'group insert failed');
  }

  return { success: true, groupToken: created.value.token, group: created.value, reused: false };
}

/**
 * Entra una partida al ranking del grupo. La titularidad se prueba con el
 * attempt firmado o con la sesión de auth (ver `ownsGameSession`); puntaje,
 * máximo y tiempo se leen de la sesión persistida por el servidor, nunca del
 * cliente. Idempotente: una sesión entra una sola vez por grupo (único +
 * reintento devuelve "ya estaba").
 */
export async function joinQuizGroup(input: {
  groupToken: string;
  sessionToken: string;
  nickname: string;
  attempt?: string;
}): Promise<ActionResult<{ entry: GroupEntry; alreadyJoined: boolean }>> {
  const { allowed } = await groupLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many requests. Try again later.');

  const parsed = z
    .object({
      groupToken: groupTokenSchema,
      sessionToken: shareTokenSchema,
      nickname: rawNicknameSchema,
      attempt: attemptSchema,
    })
    .safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { value: nickname, failure } = nicknameOrFailure(parsed.data.nickname);
  if (failure) return failure;

  const supabase = await createClient();
  const service = createServiceClient();
  if (!service) return actionFailure('unavailable', UNAVAILABLE);

  const groupRead = await fetchGroupByToken(supabase, parsed.data.groupToken);
  if (groupRead.state === 'missing') return unavailable('joinQuizGroup');
  if (groupRead.state === 'error') {
    return unexpectedFailure('joinQuizGroup.group', 'group lookup failed');
  }
  const group = groupRead.value;
  if (!group) return actionFailure('not_found', 'Group not found.');

  const sessionRead = await fetchSessionForGroup(service, parsed.data.sessionToken);
  if (sessionRead.state === 'error') {
    return unexpectedFailure('joinQuizGroup.session', 'session lookup failed');
  }
  const session = sessionRead.value;
  if (!session) return actionFailure('not_found', 'Session not found.');
  if (session.quiz_id !== group.quizId) {
    return actionFailure('invalid_input', 'This session belongs to another quiz.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await ownsGameSession(session, parsed.data.attempt, user?.id ?? null))) {
    return actionFailure('unauthorized', NOT_OWNED);
  }

  const already = await fetchGroupEntry(service, group.id, session.id);
  if (already.state === 'missing') return unavailable('joinQuizGroup');
  if (already.state === 'error') {
    return unexpectedFailure('joinQuizGroup.entry', 'entry lookup failed');
  }
  if (already.value) {
    return { success: true, entry: already.value, alreadyJoined: true };
  }

  const inserted = await insertGroupEntry(service, {
    group_id: group.id,
    nickname: nickname!,
    score: session.score,
    max_score: session.max_score,
    time_taken_seconds: session.time_taken_seconds,
    game_session_id: session.id,
  });
  if (inserted === 'missing') return unavailable('joinQuizGroup');
  if (inserted === 'error') {
    return unexpectedFailure('joinQuizGroup.insert', 'entry insert failed');
  }
  if (inserted === 'conflict') {
    const existing = await fetchGroupEntry(service, group.id, session.id);
    if (existing.value) return { success: true, entry: existing.value, alreadyJoined: true };
    return unexpectedFailure('joinQuizGroup.conflict', 'conflict without entry');
  }

  return {
    success: true,
    alreadyJoined: false,
    entry: {
      nickname: nickname!,
      score: session.score,
      maxScore: session.max_score,
      timeTakenSeconds: session.time_taken_seconds,
      gameSessionId: session.id,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Ranking público del grupo por token: datos del grupo + entradas ordenadas.
 * `sessionId` (la sesión propia, sin auth) hace que el RPC incluya su fila
 * aunque quede fuera del top 100: el resaltado y el "ya entraste" no mienten.
 */
export async function getQuizGroupLeaderboard(
  groupToken: string,
  sessionId?: string
): Promise<ActionResult<{ group: QuizGroupInfo; entries: GroupEntry[] }>> {
  const { allowed } = await groupReadLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many requests. Try again later.');

  const parsed = groupTokenSchema.safeParse(groupToken);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));
  const parsedSession = z.string().uuid().optional().safeParse(sessionId);
  if (!parsedSession.success) return actionFailure('invalid_input', 'Invalid session id.');

  const supabase = await createClient();
  const [groupRead, entriesRead] = await Promise.all([
    fetchGroupByToken(supabase, parsed.data),
    fetchGroupEntries(supabase, parsed.data, parsedSession.data),
  ]);

  if (groupRead.state === 'missing' || entriesRead.state === 'missing') {
    return unavailable('getQuizGroupLeaderboard');
  }
  if (groupRead.state === 'error' || entriesRead.state === 'error') {
    return unexpectedFailure('getQuizGroupLeaderboard', 'leaderboard lookup failed');
  }
  if (!groupRead.value) return actionFailure('not_found', 'Group not found.');

  return {
    success: true,
    group: groupRead.value,
    entries: entriesRead.value ?? [],
  };
}
