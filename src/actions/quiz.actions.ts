'use server';

/**
 * Quiz mutations.
 *
 * Thin orchestration only: authenticate, validate, delegate to a domain module,
 * persist, revalidate. Every decision (scoring, slugs, validation rules) lives
 * in `src/lib/quiz/*`, where it can be tested without a database.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CATALOG_TAGS } from '@/lib/data/cache-tags';
import { toJson } from '@/lib/supabase/json';
import { isMissingRpcFunction } from '@/lib/supabase/rpc';
import { apiLimiter, createRateLimiter, quizLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { checkAchievements } from '@/lib/quiz/achievements';
import { buildReview } from '@/lib/quiz/answer-key';
import { isShareToken } from '@/lib/quiz/challenge';
import {
  attemptsAvailable,
  createQuizAttempt,
  sessionIdsForAttempt,
  verifyQuizAttempt,
  warnAttemptsInactive,
} from '@/lib/quiz/attempt';
import { getAttemptReveals } from '@/lib/quiz/attempt-store';
import { QuizCreateSchema, localizedIssueMessages, validateQuiz } from '@/lib/quiz/validator';
import { QuizSubmissionSchema, pointsFor, scoreSubmission } from '@/lib/quiz/submission';
import { loadAnswerKeyByQuizId, type AnswerKeyQuiz } from '@/lib/quiz/quiz-repository';
import { generateUniqueSlug, provisionalSlug } from '@/lib/quiz/quiz-slug';
import {
  actionFailure,
  unexpectedFailure,
  zodMessage,
  type ActionResult,
} from '@/lib/actions/types';
import { quizLocales, revalidateQuizPages } from '@/lib/quiz/revalidate';
import { locales } from '@/lib/i18n/dictionaries';
import { createServiceClient } from '@/lib/supabase/service';
import type { Database, QuizStatus } from '@/types/database';
import type { Answer, QuizReviewItem } from '@/types/quiz';

const createQuizSchema = QuizCreateSchema.omit({ cover_image_url: true }).extend({
  /** Set by the AI assistant so the catalog can flag generated drafts. */
  is_ai_generated: z.boolean().optional().default(false),
  /**
   * 'draft' guarda el quiz privado y fuera de la cola de moderación;
   * 'review' lo envía a revisión (los administradores publican directo).
   * Sin `intent` se asume 'draft': es el estado seguro y el que promete el
   * botón "Guardar borrador" del estudio AI.
   */
  intent: z.enum(['draft', 'review']).optional().default('draft'),
});

const updateQuizSchema = z.object({
  title: z.string().min(5).max(120).optional(),
  description: z.string().max(300).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  // Mismos límites que QuizCreateSchema: un idioma fuera del catálogo deja al
  // quiz publicado pero huérfano de las páginas por locale.
  language: z.enum(locales).optional(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  estimated_minutes: z.number().int().min(1).max(30).optional(),
  // `status` stays out on purpose: publishing belongs to the moderation flow
  // (see `createQuiz`), and RLS cannot restrict columns. Zod strips any
  // client-sent `status`, so it never reaches `.update()`. Creator-initiated
  // transitions go through `setQuizStatus`.
});

type QuizInsert = Database['public']['Tables']['quizzes']['Insert'];

/** Reads the authenticated user, or `null`. */
async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** The quiz's slug, language and status when the user owns it, else `null`. */
async function ownedQuiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quizId: string,
  userId: string
): Promise<{ slug: string; language: string; status: QuizStatus } | null> {
  const { data } = await supabase
    .from('quizzes')
    .select('creator_id, slug, language, status')
    .eq('id', quizId)
    .maybeSingle();
  if (!data || data.creator_id !== userId) return null;
  return { slug: data.slug, language: data.language, status: data.status };
}

/** Código SQLSTATE con que la DB rechaza borrar un quiz con reportes abiertos. */
const DELETE_BLOCKED_ERRCODE = 'QVM03';

// ============================================
// CREATE
// ============================================

/** The `language` of the raw payload, to answer errors in the quiz's tongue. */
function inputLanguage(input: unknown): string {
  return typeof input === 'object' && input !== null && 'language' in input
    ? String((input as { language: unknown }).language)
    : 'en';
}

/** Insert attempts when a slug collides at the unique constraint. */
const MAX_SLUG_COLLISION_RETRIES = 5;

export async function createQuiz(
  input: unknown
): Promise<ActionResult<{ quiz: { id: string; slug: string } }>> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to create a quiz.');

  const { allowed } = await quizLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many quiz creations. Please wait.');

  const language = inputLanguage(input);
  const parsed = createQuizSchema.safeParse(input);
  if (!parsed.success)
    return actionFailure(
      'invalid_input',
      localizedIssueMessages(parsed.error, language).join('; ')
    );
  const validation = validateQuiz(parsed.data, parsed.data.language);
  if (!validation.valid) return actionFailure('invalid_input', validation.errors.join('; '));

  // 'review' entra a la cola de moderación (o publica directo si el autor es
  // admin); 'draft' queda privado. El perfil solo se consulta con 'review'.
  let status: QuizStatus = 'draft';
  if (parsed.data.intent === 'review') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    status = profile?.is_admin ? 'published' : 'pending';
  }

  const insert: Omit<QuizInsert, 'slug'> = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    creator_id: user.id,
    category_id: parsed.data.category_id ?? null,
    quiz_type: parsed.data.quiz_type,
    difficulty: parsed.data.difficulty,
    language: parsed.data.language,
    questions: toJson(parsed.data.questions),
    results: parsed.data.results ? toJson(parsed.data.results) : null,
    tags: parsed.data.tags ?? [],
    estimated_minutes: parsed.data.estimated_minutes ?? 3,
    question_count: parsed.data.questions.length,
    status,
    is_ai_generated: parsed.data.is_ai_generated,
  };

  // Un quiz sin publicar nace con slug provisional aleatorio. Con un slug
  // derivado del título, el sufijo de colisión delataría que otro usuario tiene
  // ese slug en un borrador o pendiente: RLS oculta esas filas, así que el
  // único observable sería la respuesta. El slug definitivo (limpio y con
  // sufijo secuencial contra todo el catálogo) se genera al publicar, donde el
  // admin sí ve todas las filas. Un admin que publica directo salta el paso
  // provisional. El 23505 se reintenta en ambos caminos y el mensaje crudo de
  // Postgres nunca llega al formulario.
  const takenSlugs = new Set<string>();
  let quiz: { id: string; slug: string } | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_SLUG_COLLISION_RETRIES && !quiz && !lastError; attempt += 1) {
    const slug =
      status === 'published'
        ? await generateUniqueSlug(parsed.data.title, {
            language: parsed.data.language,
            exists: async (candidate) => {
              if (takenSlugs.has(candidate)) return true;
              const { data } = await supabase
                .from('quizzes')
                .select('id')
                .eq('slug', candidate)
                .maybeSingle();
              return Boolean(data);
            },
          })
        : provisionalSlug(parsed.data.title, parsed.data.language);
    const { data, error } = await supabase
      .from('quizzes')
      .insert({ ...insert, slug })
      .select('id, slug')
      .single();
    if (!error && data) {
      quiz = data;
    } else if (error?.code === '23505') {
      takenSlugs.add(slug);
    } else {
      lastError = error ?? new Error('Could not save the quiz');
    }
  }

  if (!quiz) return unexpectedFailure('quiz.create', lastError);

  revalidateQuizPages(parsed.data.language, quiz.slug);

  return { success: true, quiz: { id: quiz.id, slug: quiz.slug } };
}

// ============================================
// UPDATE / DELETE
// ============================================

export async function updateQuiz(id: string, input: unknown): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to edit a quiz.');

  const { allowed } = await apiLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many actions. Please wait.');

  const quiz = await ownedQuiz(supabase, id, user.id);
  if (!quiz) return actionFailure('forbidden', 'That quiz is not yours.');

  // Un quiz published ya pasó moderación: editarlo y seguir publicado dejaría
  // el contenido cambiado sin revisión (título, descripción y tags alimentan
  // SEO y la tarjeta OG). Re-marcarlo 'pending' no es opción: el guard de la
  // migración 014 restaura `status` al valor anterior en updates con JWT de
  // no-admin (solo 'archived' o un admin pueden moverlo), así que la acción
  // rechaza la edición entera con un error tipado.
  if (quiz.status === 'published') {
    return actionFailure(
      'conflict',
      'A published quiz can no longer be edited: changes go through moderation again.'
    );
  }

  const parsed = updateQuizSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { error } = await supabase.from('quizzes').update(parsed.data).eq('id', id);
  if (error) return unexpectedFailure('quiz.update', error);

  revalidateQuizPages(quiz.language, quiz.slug);
  // A language change moves the quiz between locales: refresh the new one too.
  if (parsed.data.language && parsed.data.language !== quiz.language) {
    revalidateQuizPages(parsed.data.language, quiz.slug);
  }
  return { success: true };
}

/**
 * Deletes a quiz, or archives it when the database says it has open reports.
 *
 * Migration 016 installs `guard_quiz_delete_with_reports`: a DELETE from the
 * owner (app or raw PostgREST) raises QVM03 while unresolved reports exist, so
 * the accused cannot destroy the evidence. On that error we archive instead —
 * the quiz and its reports survive for the admin. Without the migration the
 * delete simply succeeds, as before.
 */
export async function deleteQuiz(id: string): Promise<ActionResult<{ archived: boolean }>> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to delete a quiz.');

  const { allowed } = await apiLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many actions. Please wait.');

  const quiz = await ownedQuiz(supabase, id, user.id);
  if (!quiz) return actionFailure('forbidden', 'That quiz is not yours.');

  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) {
    if (error.code === DELETE_BLOCKED_ERRCODE) {
      const { error: archiveError } = await supabase
        .from('quizzes')
        .update({ status: 'archived' })
        .eq('id', id);
      if (archiveError) return unexpectedFailure('quiz.delete', archiveError);
      revalidateQuizPages(quiz.language, quiz.slug);
      return { success: true, archived: true };
    }
    return unexpectedFailure('quiz.delete', error);
  }

  revalidateQuizPages(quiz.language, quiz.slug);
  return { success: true, archived: false };
}

const quizStatusTargetSchema = z.enum(['draft', 'pending', 'archived']);

/**
 * Transiciones que un creador puede pedir desde la app. El guard
 * `guard_quiz_editable_columns` (014, ampliado por la 015) es quien las
 * autoriza en la base; esta tabla es el contrato hacia el cliente: nada puede
 * llevar un quiz a 'published' desde aquí y 'archived' es terminal.
 */
const CREATOR_STATUS_MOVES: Record<QuizStatus, readonly QuizStatus[]> = {
  draft: ['pending', 'archived'],
  pending: ['draft', 'archived'],
  published: ['archived'],
  rejected: ['archived'],
  archived: [],
};

/**
 * Mueve el quiz propio entre los estados que el creador controla: enviar a
 * revisión (draft → pending), retirar a borrador (pending → draft) y
 * despublicar/archivar (→ archived).
 */
export async function setQuizStatus(id: string, input: unknown): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to manage a quiz.');
  const quiz = await ownedQuiz(supabase, id, user.id);
  if (!quiz) return actionFailure('forbidden', 'That quiz is not yours.');

  const target = quizStatusTargetSchema.safeParse(input);
  if (!target.success) return actionFailure('invalid_input', 'Invalid status.');
  if (target.data === quiz.status) return { success: true };
  if (!CREATOR_STATUS_MOVES[quiz.status].includes(target.data)) {
    return actionFailure('conflict', `A ${quiz.status} quiz cannot move to ${target.data}.`);
  }

  // Se pide el status de vuelta: la guardia de la base puede restaurar el
  // valor anterior sin levantar error, y en ese caso hay que reportarlo.
  const { data, error } = await supabase
    .from('quizzes')
    .update({ status: target.data })
    .eq('id', id)
    .select('status')
    .single();

  if (error || !data || data.status !== target.data) {
    return actionFailure('conflict', 'That status change is not allowed for this quiz.');
  }

  revalidateQuizPages(quiz.language, quiz.slug);
  return { success: true };
}

// ============================================
// PLAY
// ============================================

/** Mismo formato que el default de la tabla: 8 bytes aleatorios en hex. */
function newShareToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Una partida nueva por reinicio es normal; 30/min por IP ya es abuso. */
const attemptLimiter = createRateLimiter('quiz-attempt', 30, 60, 'open');

/**
 * Emite el attempt firmado de una partida.
 *
 * El reproductor lo pide al arrancar cada partida (incluidos «jugar otra vez» y
 * los cambios de modo) y lo reenvía al reveal y al envío. Sin secreto de
 * servidor devuelve `unavailable`: el juego sigue, sin feedback inmediato.
 */
export async function startQuizAttempt(
  quizId: string
): Promise<ActionResult<{ attempt: string; expiresAt: number }>> {
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return actionFailure('invalid_input', 'Invalid quiz id.');

  const { allowed } = await attemptLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many games. Please wait.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quizzes')
    .select('id')
    .eq('id', parsed.data)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return actionFailure('not_found', 'Quiz not found.');

  const attempt = await createQuizAttempt(parsed.data);
  if (!attempt) {
    console.error(
      '[quiz.attempt] sin QUIZ_ATTEMPT_SECRET ni SUPABASE_SERVICE_ROLE_KEY: ' +
        'el reveal queda deshabilitado y las partidas se puntúan al enviar.'
    );
    return actionFailure('unavailable', 'Game attempts are not configured.');
  }

  return { success: true, attempt: attempt.token, expiresAt: attempt.attempt.expiresAt };
}

export interface SubmittedAnswer {
  question_id: string;
  selected_option_id: string;
  time_ms?: number;
}

export interface SubmitGameResult {
  session: { id: string; share_token: string | null };
  result: { id: string; title: string; description: string } | null;
  score: number;
  max_score: number;
  points_earned: number;
  achievements_unlocked: Array<{ id: string; name: string }>;
  /**
   * Server-built answer review (same shape `buildReview` gives `/result`):
   * the client paints it without ever receiving the answer key.
   */
  review: QuizReviewItem[];
}

interface StoredSession {
  id: string;
  share_token: string | null;
  player_id: string | null;
  score: number;
  max_score: number;
  result_id: string | null;
  result_title: string | null;
  answers: unknown;
}

function isMissingAttemptColumn(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
    (error.code === 'PGRST204' || error.code === '42703') &&
    /attempt_id/i.test(error.message ?? '')
  );
}

function isDuplicateSession(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

let warnedMissingAttemptColumn = false;

function warnMissingAttemptColumn() {
  if (warnedMissingAttemptColumn) return;
  warnedMissingAttemptColumn = true;
  console.error(
    '[game-sessions] falta la columna attempt_id: aplica ' +
      'supabase/migrations/019_attempt_idempotencia.sql. El envío sigue funcionando.'
  );
}

/**
 * Busca una sesión ya guardada para este attempt.
 *
 * La RLS no deja leer las partidas anónimas, así que se usa service role cuando
 * existe. Si no, un anónimo no verá su propia fila y la deduplicación caerá al
 * índice único del INSERT.
 */
async function findSessionByAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  attemptId: string
): Promise<StoredSession | null> {
  const client = createServiceClient() ?? supabase;
  const { data, error } = await client
    .from('game_sessions')
    .select('id, share_token, player_id, score, max_score, result_id, result_title, answers')
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (error) {
    if (isMissingAttemptColumn(error)) warnMissingAttemptColumn();
    return null;
  }
  return (data as unknown as StoredSession | null) ?? null;
}

function storedAnswers(existing: StoredSession | null, fallback: Answer[]): Answer[] {
  if (!existing || !Array.isArray(existing.answers)) return fallback;
  return existing.answers.filter(
    (answer): answer is Answer =>
      Boolean(answer) &&
      typeof answer === 'object' &&
      typeof (answer as Answer).question_id === 'string' &&
      typeof (answer as Answer).selected_option_id === 'string'
  );
}

/**
 * Respuesta de un envío repetido: la sesión existe, no se suma nada.
 *
 * `points_earned` refleja lo que el primer envío ya otorgó (el trigger pagó al
 * insertar), no lo que este reintento pagaría: la pantalla de resultado debe
 * enseñar los puntos reales de la partida, no +0. Los logros sí se reintentan
 * (idempotente) para reparar un primer `checkAchievements` que fallara.
 *
 * Si la fila no se pudo leer (RLS sin service role), no se infieren premios:
 * un jugador que inicia sesión después de guardar una partida anónima no debe
 * ver puntos ni logros que el trigger nunca le pagó.
 */
async function duplicateSubmitResult(
  quiz: AnswerKeyQuiz,
  scored: ReturnType<typeof scoreSubmission>,
  session: { id: string; shareToken: string },
  existing: StoredSession | null,
  user: { id: string } | null
): Promise<ActionResult<SubmitGameResult>> {
  const resultId = existing?.result_id ?? scored.resultId;
  const partner = resultId ? (quiz.results ?? []).find((item) => item.id === resultId) : undefined;
  const perfect = existing
    ? existing.max_score > 0 && existing.score === existing.max_score
    : scored.perfect;
  const awarded = Boolean(existing?.player_id);
  const samePlayer = Boolean(existing?.player_id) && existing?.player_id === user?.id;

  return {
    success: true,
    session: {
      id: existing?.id ?? session.id,
      share_token: existing?.share_token ?? session.shareToken,
    },
    result: partner
      ? { id: partner.id, title: partner.title, description: partner.description }
      : null,
    score: existing?.score ?? scored.score,
    max_score: existing?.max_score ?? scored.maxScore,
    points_earned: awarded ? pointsFor(perfect) : 0,
    achievements_unlocked:
      samePlayer && user ? await checkAchievements(user.id, { perfectScore: perfect }) : [],
    review: buildReview(quiz, storedAnswers(existing, scored.graded)),
  };
}

/**
 * Persists a finished game.
 *
 * The payload carries choices only. The score, the personality result and the
 * stored `answers` are all recomputed here from the quiz in the database, so a
 * crafted request cannot buy points.
 *
 * `attemptToken` (opcional, por compatibilidad con clientes antiguos) ata el
 * envío a una partida: un segundo envío del mismo attempt devuelve la sesión
 * ya guardada sin duplicar plays ni puntos. Además, si el jugador reveló una
 * pregunta con una opción, esa opción manda sobre lo que envíe después.
 */
export async function submitQuizResult(
  quizId: string,
  answers: SubmittedAnswer[],
  timeTakenSeconds = 0,
  attemptToken?: string
): Promise<ActionResult<SubmitGameResult>> {
  const { supabase, user } = await currentUser();

  // Anonymous players are keyed by client IP (cf-connecting-ip on Cloudflare):
  // a shared 'anonymous' bucket would let ~11 strangers exhaust each other's
  // submissions and lose finished games.
  const { allowed } = await quizLimiter.check(user?.id ?? `anonymous:${await clientIp()}`);
  if (!allowed) return actionFailure('rate_limited', 'Too many submissions. Please wait.');

  const parsed = QuizSubmissionSchema.safeParse({ quizId, answers, timeTakenSeconds });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const quiz = await loadAnswerKeyByQuizId(parsed.data.quizId);
  if (!quiz) return actionFailure('not_found', 'Quiz not found.');

  const verification = attemptToken ? await verifyQuizAttempt(attemptToken, quiz.id) : null;
  if (verification && !verification.ok) {
    // Un token inválido no puede costar la partida: se guarda, pero sin premios
    // (ver `pointsEligible`) para que omitirlo no sea una vía de farmeo.
    console.warn(`[quiz.submit] attempt ${verification.reason}: se envía sin binding`);
  }
  const attempt = verification?.ok ? verification.attempt : null;

  // Con secreto configurado, un envío sin attempt válido no puede otorgar
  // puntos: si no, bastaba con revelar la clave y enviar las respuestas
  // correctas omitiendo el token. Sin secreto (modo degradado) se mantiene el
  // comportamiento anterior para no perder partidas.
  const pointsEligible = Boolean(attempt) || !attemptsAvailable();
  if (user && !pointsEligible) {
    console.warn(
      '[quiz.submit] envío autenticado sin attempt: se guarda como anónimo para no otorgar puntos'
    );
  }

  // Si hubo reveal, la opción revelada es la que vale: ver la respuesta
  // correcta y enviar otra distinta no puede mejorar el marcador.
  const revealed = attempt ? await getAttemptReveals(attempt.attemptId) : null;
  const submitted = revealed
    ? parsed.data.answers.map((answer) =>
        revealed[answer.question_id] !== undefined
          ? { ...answer, selected_option_id: revealed[answer.question_id] }
          : answer
      )
    : parsed.data.answers;

  const scored = scoreSubmission(quiz, submitted);

  const existing = attempt ? await findSessionByAttempt(supabase, attempt.attemptId) : null;
  const ids = (attempt ? await sessionIdsForAttempt(attempt.attemptId) : null) ?? {
    id: crypto.randomUUID(),
    shareToken: newShareToken(),
  };

  if (existing) return duplicateSubmitResult(quiz, scored, ids, existing, user);

  // La policy nueva de game_sessions solo deja leer las propias, así que un
  // INSERT ... RETURNING devolvería 0 filas para un anónimo y la partida se
  // perdería. id y share_token se generan aquí (misma forma que los defaults
  // de la tabla) y el insert no necesita leer nada de vuelta.
  const insert = {
    id: ids.id,
    share_token: ids.shareToken,
    quiz_id: quiz.id,
    player_id: pointsEligible ? (user?.id ?? null) : null,
    score: scored.score,
    max_score: scored.maxScore,
    result_id: scored.resultId,
    result_title: scored.resultTitle,
    time_taken_seconds: parsed.data.timeTakenSeconds,
    answers: toJson(scored.graded),
    ...(attempt ? { attempt_id: attempt.attemptId } : {}),
  };

  let { error } = await supabase.from('game_sessions').insert(insert);

  if (error && attempt && isMissingAttemptColumn(error)) {
    // Sin la migración 019 la columna no existe: se guarda como antes. El id
    // determinista sigue evitando que un reintento duplique la sesión.
    warnMissingAttemptColumn();
    const withoutAttempt = { ...insert };
    delete withoutAttempt.attempt_id;
    ({ error } = await supabase.from('game_sessions').insert(withoutAttempt));
    if (error && isDuplicateSession(error)) {
      return duplicateSubmitResult(quiz, scored, ids, null, user);
    }
  } else if (error && attempt && isDuplicateSession(error)) {
    return duplicateSubmitResult(quiz, scored, ids, null, user);
  }

  if (error) {
    return unexpectedFailure('quiz.submit', error);
  }

  // Best effort: a failed counter must never fail a finished game. Con la
  // migración 013 este EXECUTE queda revocado y el INSERT de arriba ya sumó la
  // jugada vía trigger; sin ella esta llamada es la que cuenta.
  await supabase.rpc('increment_plays', { quiz_uuid: quiz.id });

  const partner = scored.resultId
    ? (quiz.results ?? []).find((item) => item.id === scored.resultId)
    : undefined;

  return {
    success: true,
    session: { id: ids.id, share_token: ids.shareToken },
    result: partner
      ? { id: partner.id, title: partner.title, description: partner.description }
      : null,
    score: scored.score,
    max_score: scored.maxScore,
    review: buildReview(quiz, scored.graded),
    // El trigger award_quiz_points solo corre con player_id: una partida
    // anónima no otorga nada y la respuesta debe decir lo mismo.
    points_earned: pointsEligible && user ? pointsFor(scored.perfect) : 0,
    achievements_unlocked: pointsEligible
      ? await checkAchievements(user?.id ?? null, { perfectScore: scored.perfect })
      : [],
  };
}

// ============================================
// LIKES
// ============================================

/**
 * Whether the signed-in user already liked the quiz. The detail page is
 * static, so the client asks on mount — same pattern as `getQuizComments`.
 * Never throws: anonymous users and failures resolve to `authenticated:
 * false`, which the button renders as a link to login. `liked: null` means
 * the read failed — the toggle must stay disabled rather than guess, or an
 * existing like could be toggled off while the UI shows it being added.
 */
export async function getQuizLikeState(
  quizId: string
): Promise<{ authenticated: boolean; liked: boolean | null }> {
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return { authenticated: false, liked: false };

  try {
    const { supabase, user } = await currentUser();
    if (!user) return { authenticated: false, liked: false };

    const { data, error } = await supabase
      .from('quiz_likes')
      .select('quiz_id')
      .eq('quiz_id', parsed.data)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return { authenticated: true, liked: null };
    return { authenticated: true, liked: Boolean(data) };
  } catch {
    return { authenticated: false, liked: false };
  }
}

export async function likeQuiz(
  quizId: string
): Promise<ActionResult<{ liked: boolean; likesCount: number | null }>> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to like a quiz.');

  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return actionFailure('invalid_input', 'Invalid quiz id.');

  const { allowed } = await apiLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many actions. Please wait.');

  const { data, error } = await supabase.rpc('toggle_like', {
    p_quiz_id: parsed.data,
    p_user_id: user.id,
  });

  if (error) return unexpectedFailure('quiz.like', error);

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('slug, language, likes_count')
    .eq('id', parsed.data)
    .maybeSingle();

  if (quiz) {
    for (const locale of quizLocales(quiz.language)) {
      // Detail shows the count; explore ranks by likes_count.
      revalidatePath(`/${locale}/quiz`);
      revalidatePath(`/${locale}/quiz/${quiz.slug}`);
    }
    // Solo la entrada de este quiz: un like no puede tirar el catálogo entero.
    // `max` sirve la versión anterior mientras revalida en segundo plano.
    revalidateTag(CATALOG_TAGS.quiz(quiz.slug), 'max');
  }
  // likesCount lets the client show the real total, not just optimistic ±1.
  return { success: true, liked: Boolean(data), likesCount: quiz?.likes_count ?? null };
}

// ============================================
// SHARES
// ============================================

/** Generous: five share buttons per dialog, not scripted counter inflation. */
const shareLimiter = createRateLimiter('quiz-share', 30, 60);

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

/**
 * Counts a share. Fire-and-forget from the share buttons: a failure must never
 * reach the player, and anonymous visitors share results too.
 */
export async function incrementShares(quizId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return actionFailure('invalid_input', 'Invalid quiz id.');

  // A throttled share skips the counter but reports success: the player's
  // share flow must never break over telemetry. When the limiter itself fails
  // (Redis down) we still count — better unbounded counts during an outage
  // than silently lost metrics.
  const { allowed, errored } = await shareLimiter.check(await clientIp());
  if (!allowed && !errored) return { success: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc('increment_shares', { quiz_uuid: parsed.data });
  if (error) return unexpectedFailure('quiz.share', error);

  return { success: true };
}

/**
 * J12: marca la partida como compartida cuando el jugador comparte su propio
 * resultado. El token es el mismo opaco de `/result?s=`; uno desconocido no
 * actualiza nada y la acción responde igual, para no revelar si existe.
 */
export async function markSessionShared(shareToken: string): Promise<ActionResult> {
  const parsed = z.string().refine(isShareToken, 'Invalid share token.').safeParse(shareToken);
  if (!parsed.success) return actionFailure('invalid_input', 'Invalid share token.');

  const { allowed, errored } = await shareLimiter.check(await clientIp());
  if (!allowed && !errored) return { success: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_session_shared', { p_token: parsed.data });
  // Mientras la migración 018 no esté aplicada el RPC no existe: el share
  // sigue funcionando y la métrica se empieza a llenar cuando se aplique.
  if (error && !isMissingRpcFunction(error)) {
    return unexpectedFailure('quiz.share_session', error);
  }

  return { success: true };
}
