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
import { isNicknameAllowed, type NicknameDenyReason } from '@/lib/moderation/nickname';
import {
  fetchExistingGroup,
  fetchGroupByToken,
  fetchGroupEntries,
  fetchGroupEntry,
  fetchSessionForGroup,
  insertGroup,
  insertGroupEntry,
} from '@/lib/data/group';

/** 20/min por IP: crea grupos, une entradas y consulta rankings. */
const groupLimiter = createRateLimiter('quiz-group', 20, 60, 'open');

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

const groupTokenSchema = z.string().refine(isGroupToken, { message: 'Invalid group token.' });
const shareTokenSchema = z.string().refine(isShareToken, { message: 'Invalid session token.' });
/** Texto libre acotado; la forma concreta la decide el filtro de apodos. */
const rawNicknameSchema = z.string().min(1).max(80);

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
 * Crea (o reutiliza) el grupo del que comparte el resultado. El `shareToken`
 * prueba la propiedad de la sesión — es un secreto bearer ya existente — y la
 * sesión aporta quiz y creador; el apodo del creador se modera igual que el de
 * cualquier entrada.
 */
export async function createQuizGroup(input: {
  shareToken: string;
  nickname: string;
}): Promise<ActionResult<{ groupToken: string; group: QuizGroupInfo; reused: boolean }>> {
  const { allowed } = await groupLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many requests. Try again later.');

  const parsed = z
    .object({ shareToken: shareTokenSchema, nickname: rawNicknameSchema })
    .safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { value: nickname, failure } = nicknameOrFailure(parsed.data.nickname);
  if (failure) return failure;

  const service = createServiceClient();
  if (!service) return actionFailure('unavailable', UNAVAILABLE);

  const sessionRead = await fetchSessionForGroup(service, parsed.data.shareToken);
  if (sessionRead.state === 'error') {
    return unexpectedFailure('createQuizGroup.session', 'session lookup failed');
  }
  const session = sessionRead.value;
  if (!session) return actionFailure('not_found', 'Session not found.');

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
  if (created.state === 'error' || !created.value) {
    return unexpectedFailure('createQuizGroup.insert', 'group insert failed');
  }

  return { success: true, groupToken: created.value.token, group: created.value, reused: false };
}

/**
 * Entra una partida al ranking del grupo. El `sessionToken` prueba la
 * propiedad de la sesión; puntaje, máximo y tiempo se leen de la sesión
 * persistida por el servidor, nunca del cliente. Idempotente: una sesión
 * entra una sola vez por grupo (único + reintento devuelve "ya estaba").
 */
export async function joinQuizGroup(input: {
  groupToken: string;
  sessionToken: string;
  nickname: string;
}): Promise<ActionResult<{ entry: GroupEntry; alreadyJoined: boolean }>> {
  const { allowed } = await groupLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many requests. Try again later.');

  const parsed = z
    .object({
      groupToken: groupTokenSchema,
      sessionToken: shareTokenSchema,
      nickname: rawNicknameSchema,
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

/** Ranking público del grupo por token: datos del grupo + entradas ordenadas. */
export async function getQuizGroupLeaderboard(
  groupToken: string
): Promise<ActionResult<{ group: QuizGroupInfo; entries: GroupEntry[] }>> {
  const { allowed } = await groupLimiter.check(await clientIp(), { record: false });
  if (!allowed) return actionFailure('rate_limited', 'Too many requests. Try again later.');

  const parsed = groupTokenSchema.safeParse(groupToken);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const supabase = await createClient();
  const [groupRead, entriesRead] = await Promise.all([
    fetchGroupByToken(supabase, parsed.data),
    fetchGroupEntries(supabase, parsed.data),
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
