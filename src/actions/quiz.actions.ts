'use server';

/**
 * Quiz mutations.
 *
 * Thin orchestration only: authenticate, validate, delegate to a domain module,
 * persist, revalidate. Every decision (scoring, slugs, validation rules) lives
 * in `src/lib/quiz/*`, where it can be tested without a database.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { toJson } from '@/lib/supabase/json';
import { apiLimiter, createRateLimiter, quizLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { checkAchievements } from '@/lib/quiz/achievements';
import { buildReview } from '@/lib/quiz/answer-key';
import { QuizCreateSchema, validateQuiz } from '@/lib/quiz/validator';
import { QuizSubmissionSchema, pointsFor, scoreSubmission } from '@/lib/quiz/submission';
import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';
import { generateUniqueSlug } from '@/lib/quiz/quiz-slug';
import {
  actionFailure,
  unexpectedFailure,
  zodMessage,
  type ActionResult,
} from '@/lib/actions/types';
import { quizLocales, revalidateQuizPages } from '@/lib/quiz/revalidate';
import { locales } from '@/lib/i18n/dictionaries';
import type { Database } from '@/types/database';
import type { QuizReviewItem } from '@/types/quiz';

const createQuizSchema = QuizCreateSchema.omit({ cover_image_url: true }).extend({
  /** Set by the AI assistant so the catalog can flag generated drafts. */
  is_ai_generated: z.boolean().optional().default(false),
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
  // client-sent `status`, so it never reaches `.update()`.
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
): Promise<{ slug: string; language: string; status: string } | null> {
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

export async function createQuiz(
  input: unknown
): Promise<ActionResult<{ quiz: { id: string; slug: string } }>> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to create a quiz.');

  const { allowed } = await quizLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many quiz creations. Please wait.');

  const parsed = createQuizSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));
  const validation = validateQuiz(parsed.data, parsed.data.language);
  if (!validation.valid) return actionFailure('invalid_input', validation.errors.join('; '));

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  const slug = await generateUniqueSlug(parsed.data.title, {
    language: parsed.data.language,
    exists: async (candidate) => {
      const { data } = await supabase
        .from('quizzes')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();
      return Boolean(data);
    },
  });

  const insert: QuizInsert = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    slug,
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
    // Community submissions wait for review; admins publish straight away.
    status: profile?.is_admin ? 'published' : 'pending',
    is_ai_generated: parsed.data.is_ai_generated,
  };

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert(insert)
    .select('id, slug')
    .single();

  if (error || !quiz) return unexpectedFailure('quiz.create', error);

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

// ============================================
// PLAY
// ============================================

/** Mismo formato que el default de la tabla: 8 bytes aleatorios en hex. */
function newShareToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

/**
 * Persists a finished game.
 *
 * The payload carries choices only. The score, the personality result and the
 * stored `answers` are all recomputed here from the quiz in the database, so a
 * crafted request cannot buy points.
 */
export async function submitQuizResult(
  quizId: string,
  answers: SubmittedAnswer[],
  timeTakenSeconds = 0
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

  const scored = scoreSubmission(quiz, parsed.data.answers);

  // La policy nueva de game_sessions solo deja leer las propias, así que un
  // INSERT ... RETURNING devolvería 0 filas para un anónimo y la partida se
  // perdería. id y share_token se generan aquí (misma forma que los defaults
  // de la tabla) y el insert no necesita leer nada de vuelta.
  const session = { id: crypto.randomUUID(), share_token: newShareToken() };
  const { error } = await supabase.from('game_sessions').insert({
    id: session.id,
    share_token: session.share_token,
    quiz_id: quiz.id,
    player_id: user?.id ?? null,
    score: scored.score,
    max_score: scored.maxScore,
    result_id: scored.resultId,
    result_title: scored.resultTitle,
    time_taken_seconds: parsed.data.timeTakenSeconds,
    answers: toJson(scored.graded),
  });

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
    session: { id: session.id, share_token: session.share_token },
    result: partner
      ? { id: partner.id, title: partner.title, description: partner.description }
      : null,
    score: scored.score,
    max_score: scored.maxScore,
    review: buildReview(quiz, scored.graded),
    // El trigger award_quiz_points solo corre con player_id: una partida
    // anónima no otorga nada y la respuesta debe decir lo mismo.
    points_earned: user ? pointsFor(scored.perfect) : 0,
    achievements_unlocked: await checkAchievements(user?.id ?? null, {
      perfectScore: scored.perfect,
    }),
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
