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
import { checkAchievements } from '@/lib/quiz/achievements';
import { QuizCreateSchema } from '@/lib/quiz/validator';
import { QuizSubmissionSchema, pointsFor, scoreSubmission } from '@/lib/quiz/submission';
import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';
import { generateUniqueSlug } from '@/lib/quiz/quiz-slug';
import { actionFailure, zodMessage, type ActionResult } from '@/lib/actions/types';
import type { Database } from '@/types/database';

const createQuizSchema = QuizCreateSchema.omit({ cover_image_url: true }).extend({
  /** Set by the AI assistant so the catalogue can flag generated drafts. */
  is_ai_generated: z.boolean().optional().default(false),
});

const updateQuizSchema = z.object({
  title: z.string().min(5).max(120).optional(),
  description: z.string().max(300).optional(),
  quiz_type: z.enum(['trivia', 'personality', 'poll']).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  language: z.string().optional(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  estimated_minutes: z.number().optional(),
  status: z.enum(['draft', 'published', 'pending']).optional(),
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

/** True when the authenticated user owns the quiz. */
async function ownsQuiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quizId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('quizzes')
    .select('creator_id')
    .eq('id', quizId)
    .maybeSingle();
  return Boolean(data && data.creator_id === userId);
}

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

  if (error || !quiz)
    return actionFailure('unexpected', error?.message ?? 'Could not save the quiz.');

  revalidatePath('/quiz');
  revalidatePath('/');

  return { success: true, quiz: { id: quiz.id, slug: quiz.slug } };
}

// ============================================
// UPDATE / DELETE
// ============================================

export async function updateQuiz(id: string, input: unknown): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to edit a quiz.');
  if (!(await ownsQuiz(supabase, id, user.id))) {
    return actionFailure('forbidden', 'That quiz is not yours.');
  }

  const parsed = updateQuizSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { error } = await supabase.from('quizzes').update(parsed.data).eq('id', id);
  if (error) return actionFailure('unexpected', error.message);

  revalidatePath('/quiz');
  revalidatePath('/');
  return { success: true };
}

export async function deleteQuiz(id: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'You need an account to delete a quiz.');
  if (!(await ownsQuiz(supabase, id, user.id))) {
    return actionFailure('forbidden', 'That quiz is not yours.');
  }

  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) return actionFailure('unexpected', error.message);

  revalidatePath('/quiz');
  revalidatePath('/');
  return { success: true };
}

// ============================================
// PLAY
// ============================================

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

  const { allowed } = await quizLimiter.check(user?.id ?? 'anonymous');
  if (!allowed) return actionFailure('rate_limited', 'Too many submissions. Please wait.');

  const parsed = QuizSubmissionSchema.safeParse({ quizId, answers, timeTakenSeconds });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const quiz = await loadAnswerKeyByQuizId(parsed.data.quizId);
  if (!quiz) return actionFailure('not_found', 'Quiz not found.');

  const scored = scoreSubmission(quiz, parsed.data.answers);

  const { data: session, error } = await supabase
    .from('game_sessions')
    .insert({
      quiz_id: quiz.id,
      player_id: user?.id ?? null,
      score: scored.score,
      max_score: scored.maxScore,
      result_id: scored.resultId,
      result_title: scored.resultTitle,
      time_taken_seconds: parsed.data.timeTakenSeconds,
      answers: toJson(scored.graded),
    })
    .select('id, share_token')
    .single();

  if (error || !session) {
    return actionFailure('unexpected', error?.message ?? 'Could not save the result.');
  }

  // Best effort: a failed counter must never fail a finished game.
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
    points_earned: pointsFor(scored.perfect),
    achievements_unlocked: await checkAchievements(user?.id ?? null, {
      perfectScore: scored.perfect,
    }),
  };
}

// ============================================
// LIKES
// ============================================

export async function likeQuiz(quizId: string): Promise<ActionResult<{ liked: boolean }>> {
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

  if (error) return actionFailure('unexpected', error.message);

  revalidatePath(`/quiz/${parsed.data}`);
  return { success: true, liked: Boolean(data) };
}

// ============================================
// SHARES
// ============================================

/** Generous: five share buttons per dialog, not scripted counter inflation. */
const shareLimiter = createRateLimiter('quiz-share', 30, 60);

/** Falls back to `x-real-ip` when the proxy chain is missing. */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headerList.get('x-real-ip') ?? 'unknown';
}

/**
 * Counts a share. Fire-and-forget from the share buttons: a failure must never
 * reach the player, and anonymous visitors share results too.
 */
export async function incrementShares(quizId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return actionFailure('invalid_input', 'Invalid quiz id.');

  // A throttled share skips the counter but reports success: the player's
  // share flow must never break over telemetry.
  const { allowed } = await shareLimiter.check(await clientIp());
  if (!allowed) return { success: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc('increment_shares', { quiz_uuid: parsed.data });
  if (error) return actionFailure('unexpected', error.message);

  return { success: true };
}
