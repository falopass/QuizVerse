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
  type QuizAttempt,
  type QuizAttemptVariant,
} from '@/lib/quiz/attempt';
import * as attemptStore from '@/lib/quiz/attempt-store';
import { DAILY_QUESTION_COUNT, dateFromDayKey, pickDailyQuestions } from '@/lib/content/daily-pick';
import { parseQuestions } from '@/lib/data/normalizers';
import {
  PersonalityResultSchema,
  QuestionSchema,
  QuizCreateSchema,
  localizedIssueMessages,
  validateQuiz,
} from '@/lib/quiz/validator';
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
import type { Answer, PersonalityResult, Question, QuizReviewItem } from '@/types/quiz';

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
  // Solo se admiten cuando el quiz sigue en `status = 'draft'` (validado en
  // `updateQuiz` y protegido en DB por la migración 030).
  questions: z.array(QuestionSchema).min(1).max(20).optional(),
  results: z.array(PersonalityResultSchema).optional().nullable(),
  // `status` stays out on purpose: publishing belongs to the moderation flow
  // (see `createQuiz`), and RLS cannot restrict columns. Zod strips any
  // client-sent `status`, so it never reaches `.update()`. Creator-initiated
  // transitions go through `setQuizStatus`.
});

type QuizInsert = Database['public']['Tables']['quizzes']['Insert'];
type QuizUpdate = Database['public']['Tables']['quizzes']['Update'];

/** Reads the authenticated user, or `null`. */
async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

interface OwnedQuizRecord {
  slug: string;
  language: string;
  status: QuizStatus;
  title?: string;
  quiz_type?: Database['public']['Enums']['quiz_type'];
  difficulty?: Database['public']['Enums']['difficulty'];
  questions?: unknown;
  results?: unknown;
}

/** The quiz's slug, language and status when the user owns it, else `null`. */
async function ownedQuiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quizId: string,
  userId: string
): Promise<OwnedQuizRecord | null> {
  const { data } = await supabase
    .from('quizzes')
    .select('creator_id, slug, language, status, title, quiz_type, difficulty, questions, results')
    .eq('id', quizId)
    .maybeSingle();
  if (!data || data.creator_id !== userId) return null;
  return {
    slug: data.slug,
    language: data.language,
    status: data.status,
    title: data.title,
    quiz_type: data.quiz_type,
    difficulty: data.difficulty,
    questions: data.questions,
    results: data.results,
  };
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

export interface OwnDraftContent {
  editable: boolean;
  status: QuizStatus;
  questions: Question[];
  results: PersonalityResult[] | null;
}

/**
 * Devuelve las preguntas (y resultados de personalidad) editables únicamente
 * cuando el quiz pertenece al usuario autenticado y sigue en `status = 'draft'`.
 *
 * Nunca entrega claves de quizzes publicados, pendientes, rechazados ni
 * archivados. Compatible con la migración 030 aplicada y sin aplicar: usa
 * `service_role` sobre `quiz_answer_keys` si existe, luego la RPC
 * `get_own_draft_questions` (030) y finalmente `quizzes.questions`.
 */
export async function getOwnDraftContent(id: string): Promise<ActionResult<OwnDraftContent>> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to edit a quiz.');

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return actionFailure('invalid_input', 'Invalid quiz id.');

  const { allowed } = await apiLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many actions. Please wait.');

  const quiz = await ownedQuiz(supabase, parsedId.data, user.id);
  if (!quiz) return actionFailure('forbidden', 'That quiz is not yours.');

  if (quiz.status !== 'draft') {
    return {
      success: true,
      editable: false,
      status: quiz.status,
      questions: [],
      results: null,
    };
  }

  let rawQuestions: unknown = quiz.questions;

  const service = createServiceClient();
  if (service) {
    const { data: keyRow } = await service
      .from('quiz_answer_keys')
      .select('questions')
      .eq('quiz_id', parsedId.data)
      .maybeSingle();
    if (keyRow?.questions) rawQuestions = keyRow.questions;
  } else {
    const { data: rpcQuestions, error: rpcError } = await supabase.rpc('get_own_draft_questions', {
      p_quiz_id: parsedId.data,
    });
    if (!rpcError && rpcQuestions) {
      rawQuestions = rpcQuestions;
    } else if (rpcError && !isMissingRpcFunction(rpcError)) {
      return unexpectedFailure('quiz.draftContent', rpcError);
    }
  }

  const questions = Array.isArray(rawQuestions) ? (rawQuestions as Question[]) : [];
  const results = Array.isArray(quiz.results) ? (quiz.results as PersonalityResult[]) : null;

  return {
    success: true,
    editable: true,
    status: 'draft',
    questions,
    results,
  };
}

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

  const editingContent = parsed.data.questions !== undefined || parsed.data.results !== undefined;
  if (editingContent) {
    if (quiz.status !== 'draft') {
      return actionFailure(
        'conflict',
        'Questions and results can only be edited while the quiz is a draft.'
      );
    }
    const targetLanguage = parsed.data.language ?? quiz.language;
    const candidate = {
      title: parsed.data.title ?? quiz.title ?? 'Draft quiz title',
      description: parsed.data.description,
      quiz_type: quiz.quiz_type ?? 'trivia',
      difficulty: parsed.data.difficulty ?? quiz.difficulty ?? 'medium',
      language: targetLanguage,
      category_id: parsed.data.category_id,
      questions: parsed.data.questions ?? quiz.questions,
      results: parsed.data.results !== undefined ? parsed.data.results : quiz.results,
      tags: parsed.data.tags,
      estimated_minutes: parsed.data.estimated_minutes,
    };
    const validation = validateQuiz(candidate, targetLanguage);
    if (!validation.valid) {
      return actionFailure('invalid_input', validation.errors.join('; '));
    }
  }

  const payload: QuizUpdate = {};
  if (parsed.data.title !== undefined) payload.title = parsed.data.title;
  if (parsed.data.description !== undefined) payload.description = parsed.data.description;
  if (parsed.data.difficulty !== undefined) payload.difficulty = parsed.data.difficulty;
  if (parsed.data.language !== undefined) payload.language = parsed.data.language;
  if (parsed.data.category_id !== undefined) payload.category_id = parsed.data.category_id;
  if (parsed.data.tags !== undefined) payload.tags = parsed.data.tags;
  if (parsed.data.estimated_minutes !== undefined)
    payload.estimated_minutes = parsed.data.estimated_minutes;
  if (parsed.data.questions !== undefined) payload.questions = toJson(parsed.data.questions);
  if (parsed.data.results !== undefined) {
    payload.results = parsed.data.results ? toJson(parsed.data.results) : null;
  }

  const { error } = await supabase.from('quizzes').update(payload).eq('id', id);
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

function isFallbackQuizId(quizId: string | null | undefined): boolean {
  return typeof quizId === 'string' && quizId.startsWith('launch-');
}

function optionalAttemptStoreFn<T>(name: keyof typeof attemptStore): T | null {
  try {
    const fn = attemptStore[name];
    return typeof fn === 'function' ? (fn as unknown as T) : null;
  } catch {
    return null;
  }
}

function authoritativeTimeForAttempt(
  clientSeconds: number,
  attempt: Pick<QuizAttempt, 'issuedAt' | 'expiresAt'> | null
): number {
  const maxSeconds = 2 * 60 * 60;
  const sanitizedClient = Math.min(maxSeconds, Math.max(0, Math.trunc(clientSeconds || 0)));
  if (!attempt || !Number.isInteger(attempt.issuedAt) || !Number.isInteger(attempt.expiresAt)) {
    return sanitizedClient;
  }
  const ttl = 3 * 60 * 60;
  if (attempt.expiresAt - attempt.issuedAt !== ttl) {
    return sanitizedClient;
  }
  const elapsed = Math.floor(Date.now() / 1000) - attempt.issuedAt;
  if (elapsed <= 0 || elapsed > ttl) {
    return sanitizedClient;
  }
  return Math.min(maxSeconds, elapsed);
}

export interface StartQuizAttemptOptions {
  mode?: QuizAttemptVariant;
  dayKey?: string;
}

/**
 * Emite el attempt firmado de una partida.
 *
 * El reproductor lo pide al arrancar cada partida (incluidos «jugar otra vez» y
 * los cambios de modo) y lo reenvía al reveal y al envío. Sin secreto de
 * servidor devuelve `unavailable`: el cliente juega sin token y el reveal
 * responde en modo degradado (como antes de los attempts).
 */
export async function startQuizAttempt(
  quizId: string,
  options?: StartQuizAttemptOptions
): Promise<ActionResult<{ attempt: string; expiresAt: number }>> {
  if (isFallbackQuizId(quizId)) {
    return actionFailure('unavailable', 'Fallback catalog quizzes cannot be graded right now.');
  }
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return actionFailure('invalid_input', 'Invalid quiz id.');

  const { allowed } = await attemptLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many games. Please wait.');

  const supabase = await createClient();
  const user = supabase.auth?.getUser ? ((await supabase.auth.getUser()).data?.user ?? null) : null;
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, questions')
    .eq('id', parsed.data)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return actionFailure('not_found', 'Quiz not found.');

  const rawQuestions = (data as { id: string; questions?: unknown }).questions;
  let questionIds: string[] | undefined;
  if (Array.isArray(rawQuestions)) {
    const parsedQuestions = parseQuestions(rawQuestions as Parameters<typeof parseQuestions>[0]);
    if (options?.mode === 'daily' && options.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(options.dayKey)) {
      questionIds = pickDailyQuestions(parsedQuestions, dateFromDayKey(options.dayKey))
        .slice(0, DAILY_QUESTION_COUNT)
        .map((q) => q.id);
    } else if (parsedQuestions.length > 0) {
      questionIds = parsedQuestions.map((q) => q.id);
    }
  }

  const attempt = await createQuizAttempt(parsed.data, Date.now(), {
    userId: user?.id ?? null,
    variant: options?.mode ?? 'normal',
    ...(questionIds && questionIds.length > 0 ? { questionIds } : {}),
    ...(options?.dayKey ? { dayKey: options.dayKey } : {}),
  });
  if (!attempt) {
    warnAttemptsInactive();
    return actionFailure('unavailable', 'Game attempts are not configured.');
  }

  const initFn = optionalAttemptStoreFn<typeof attemptStore.initAttemptState>('initAttemptState');
  if (initFn) {
    const initialized = await initFn(attempt.attempt.attemptId);
    if (!initialized) {
      return actionFailure('unavailable', 'Game state store is temporarily unavailable.');
    }
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
      'supabase/migrations/020_attempt_idempotencia.sql. El envío sigue funcionando.'
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

/**
 * Busca la sesión por su id determinista.
 *
 * Sin la migración 020 la búsqueda por `attempt_id` falla (columna ausente),
 * pero el id ya existe desde el primer INSERT. La RLS solo deja leer la fila
 * si es del jugador actual, que es exactamente lo necesario para no inventar
 * premios de una partida anónima.
 */
async function findSessionById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<StoredSession | null> {
  const client = createServiceClient() ?? supabase;
  const { data, error } = await client
    .from('game_sessions')
    .select('id, share_token, player_id, score, max_score, result_id, result_title, answers')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
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

function hasValidStoredParticipation(quiz: AnswerKeyQuiz, existing: StoredSession | null): boolean {
  if (!existing) return false;
  if (existing.score > 0) return true;
  if (!Array.isArray(existing.answers)) return false;
  return existing.answers.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const answer = item as Answer;
    if (typeof answer.question_id !== 'string' || typeof answer.selected_option_id !== 'string') {
      return false;
    }
    if (!answer.selected_option_id) return false;
    const question = quiz.questions.find((q) => q.id === answer.question_id);
    return question
      ? question.options.some((opt) => opt.id === answer.selected_option_id)
      : Boolean(answer.selected_option_id);
  });
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
  user: { id: string } | null,
  reviewAuthorized = true
): Promise<ActionResult<SubmitGameResult>> {
  const resultId = existing?.result_id ?? scored.resultId;
  const partner = resultId ? (quiz.results ?? []).find((item) => item.id === resultId) : undefined;
  const participated = existing ? hasValidStoredParticipation(quiz, existing) : scored.participated;
  const perfectTrivia =
    quiz.quiz_type === 'trivia' &&
    (existing
      ? existing.max_score > 0 && existing.score === existing.max_score
      : scored.perfectTrivia);
  const awarded = Boolean(existing?.player_id) && participated;
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
    points_earned: awarded
      ? pointsFor(perfectTrivia, { participated, quizType: quiz.quiz_type })
      : 0,
    achievements_unlocked:
      samePlayer && user && awarded
        ? await checkAchievements(user.id, { perfectScore: perfectTrivia })
        : [],
    review: reviewAuthorized ? buildReview(quiz, storedAnswers(existing, scored.graded)) : [],
  };
}

export interface SubmitQuizOptions {
  mode?: QuizAttemptVariant;
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
  attemptToken?: string,
  options?: SubmitQuizOptions
): Promise<ActionResult<SubmitGameResult>> {
  const { supabase, user } = await currentUser();

  // Anonymous players are keyed by client IP (cf-connecting-ip on Cloudflare):
  // a shared 'anonymous' bucket would let ~11 strangers exhaust each other's
  // submissions and lose finished games.
  const { allowed } = await quizLimiter.check(user?.id ?? `anonymous:${await clientIp()}`);
  if (!allowed) return actionFailure('rate_limited', 'Too many submissions. Please wait.');

  if (isFallbackQuizId(quizId)) {
    return actionFailure('unavailable', 'Fallback catalog quizzes cannot be graded right now.');
  }

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

  let verifiedAttempt: QuizAttempt | null = verification?.ok ? verification.attempt : null;
  if (verifiedAttempt) {
    const quizQuestionIds = quiz.questions.map((question) => question.id);
    const wrongVariant = verifiedAttempt.variant === 'daily';
    const wrongOwner =
      verifiedAttempt.userId !== undefined &&
      verifiedAttempt.userId !== null &&
      verifiedAttempt.userId !== (user?.id ?? null);
    const wrongQuestions =
      Array.isArray(verifiedAttempt.questionIds) &&
      (verifiedAttempt.questionIds.length !== quizQuestionIds.length ||
        verifiedAttempt.questionIds.some((id, idx) => id !== quizQuestionIds[idx]));

    if (wrongVariant || wrongOwner || wrongQuestions) {
      console.warn('[quiz.submit] attempt scope_mismatch: se envía sin binding');
      verifiedAttempt = null;
    }
  }
  const attempt = verifiedAttempt;

  // Con secreto configurado, un envío sin attempt válido no puede otorgar
  // puntos: si no, bastaba con revelar la clave y enviar las respuestas
  // correctas omitiendo el token. Sin secreto (modo degradado) se mantiene el
  // comportamiento anterior para no perder partidas.
  const secured = attemptsAvailable();
  if (!secured) warnAttemptsInactive();

  // Si hubo reveal, la opción revelada es la que vale: ver la respuesta
  // correcta y enviar otra distinta no puede mejorar el marcador.
  const revealed = attempt ? await attemptStore.getAttemptReveals(attempt.attemptId) : null;
  const stateLost = secured && Boolean(attempt) && revealed === null;
  if (stateLost) {
    console.warn(
      '[quiz.submit] estado del attempt no disponible (caída o cambio de isolate): se degrada a práctica sin premios'
    );
  }

  const submittedChoiceMap: Record<string, string> = {};
  for (const answer of parsed.data.answers) {
    if (
      answer.question_id &&
      typeof answer.selected_option_id === 'string' &&
      answer.selected_option_id.length > 0 &&
      submittedChoiceMap[answer.question_id] === undefined
    ) {
      submittedChoiceMap[answer.question_id] = answer.selected_option_id;
    }
  }

  const finalizeFn =
    optionalAttemptStoreFn<typeof attemptStore.finalizeAttemptState>('finalizeAttemptState');
  const finalized =
    attempt && !stateLost && finalizeFn
      ? await finalizeFn(attempt.attemptId, submittedChoiceMap)
      : null;
  const lockedChoices = finalized?.ok ? finalized.choices : revealed;

  const submitted = lockedChoices
    ? parsed.data.answers.map((answer) =>
        lockedChoices[answer.question_id] !== undefined
          ? { ...answer, selected_option_id: lockedChoices[answer.question_id] }
          : answer
      )
    : parsed.data.answers;

  const scored = scoreSubmission(quiz, submitted);

  const isPractice = options?.mode === 'practice' || attempt?.variant === 'practice';
  const startedAnonymouslyAndLoggedInLater = Boolean(
    attempt && attempt.userId === null && user?.id
  );
  const hasValidAttemptForRewards =
    Boolean(attempt) && !stateLost && !isPractice && !startedAnonymouslyAndLoggedInLater;
  const pointsEligible =
    scored.participated && !isPractice && (hasValidAttemptForRewards || !secured);
  const reviewAuthorized = !secured || (Boolean(attempt) && !stateLost);

  if (user && !pointsEligible) {
    console.warn(
      '[quiz.submit] envío autenticado no elegible para premios (sin attempt, práctica o cero participación): se guarda como anónimo'
    );
  }

  const ids = (attempt ? await sessionIdsForAttempt(attempt.attemptId) : null) ?? {
    id: crypto.randomUUID(),
    shareToken: newShareToken(),
  };
  let existing = attempt ? await findSessionByAttempt(supabase, attempt.attemptId) : null;
  if (!existing && attempt) {
    existing = await findSessionById(supabase, ids.id);
  }

  if (existing) {
    return duplicateSubmitResult(quiz, scored, ids, existing, user, reviewAuthorized);
  }

  const authoritativeTimeSeconds = authoritativeTimeForAttempt(
    parsed.data.timeTakenSeconds,
    attempt
  );

  // La policy de game_sessions solo deja leer las propias y la migración 026
  // reserva el INSERT al escritor de servidor (`service_role`). Cuando no hay
  // `SUPABASE_SERVICE_ROLE_KEY` (entornos locales/tests sin migración 026) cae
  // al cliente SSR normal.
  const writer = createServiceClient() ?? supabase;
  const insert = {
    id: ids.id,
    share_token: ids.shareToken,
    quiz_id: quiz.id,
    player_id: pointsEligible ? (user?.id ?? null) : null,
    score: scored.score,
    max_score: scored.maxScore,
    result_id: scored.resultId,
    result_title: scored.resultTitle,
    time_taken_seconds: authoritativeTimeSeconds,
    answers: toJson(scored.graded),
    ...(attempt ? { attempt_id: attempt.attemptId } : {}),
  };

  let { error } = await writer.from('game_sessions').insert(insert);

  if (error && attempt && isMissingAttemptColumn(error)) {
    // Sin la migración 020 la columna no existe: se guarda como antes. El id
    // determinista sigue evitando que un reintento duplique la sesión.
    warnMissingAttemptColumn();
    const withoutAttempt = { ...insert };
    delete withoutAttempt.attempt_id;
    ({ error } = await writer.from('game_sessions').insert(withoutAttempt));
    if (error && isDuplicateSession(error)) {
      const winner = await findSessionById(supabase, ids.id);
      return duplicateSubmitResult(quiz, scored, ids, winner, user, reviewAuthorized);
    }
  } else if (error && attempt && isDuplicateSession(error)) {
    const winner =
      (await findSessionByAttempt(supabase, attempt.attemptId)) ??
      (await findSessionById(supabase, ids.id));
    return duplicateSubmitResult(quiz, scored, ids, winner, user, reviewAuthorized);
  }

  if (error) {
    return unexpectedFailure('quiz.submit', error);
  }

  // Best effort: a failed counter must never fail a finished game. Con la
  // migración 013 este EXECUTE queda revocado para roles públicos y el INSERT
  // de arriba ya sumó la jugada vía trigger; sin ella esta llamada es la que cuenta.
  await writer.rpc('increment_plays', { quiz_uuid: quiz.id });

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
    review: reviewAuthorized ? buildReview(quiz, scored.graded) : [],
    // El trigger award_quiz_points solo corre con player_id y participación;
    // la perfección (+25) es exclusiva de trivia.
    points_earned:
      pointsEligible && user
        ? pointsFor(scored.perfectTrivia, {
            participated: scored.participated,
            quizType: quiz.quiz_type,
          })
        : 0,
    achievements_unlocked: pointsEligible
      ? await checkAchievements(user?.id ?? null, { perfectScore: scored.perfectTrivia })
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

  const writer = createServiceClient() ?? (await createClient());
  const { error } = await writer.rpc('increment_shares', { quiz_uuid: parsed.data });
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

  const writer = createServiceClient() ?? (await createClient());
  const { error } = await writer.rpc('mark_session_shared', { p_token: parsed.data });
  // Mientras la migración 018 no esté aplicada el RPC no existe: el share
  // sigue funcionando y la métrica se empieza a llenar cuando se aplique.
  if (error && !isMissingRpcFunction(error)) {
    return unexpectedFailure('quiz.share_session', error);
  }

  return { success: true };
}
