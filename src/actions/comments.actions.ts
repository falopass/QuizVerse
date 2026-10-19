'use server';

/**
 * Comentarios de la ficha del quiz.
 *
 * La tabla `quiz_comments` y su RLS existen desde la migración 005: lectura
 * pública en quizzes publicados y escritura solo del propio usuario
 * autenticado. El trigger `trg_notify_comment` (migración 007) avisa al creador
 * del quiz al insertar; aquí solo se escribe la fila.
 *
 * La ficha es estática: estas actions corren desde el cliente y nunca llaman
 * `revalidatePath`.
 */

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { actionFailure, zodMessage, type ActionResult } from '@/lib/actions/types';

export interface QuizCommentAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface QuizComment {
  id: string;
  body: string;
  created_at: string;
  author: QuizCommentAuthor | null;
}

export interface QuizCommentsPage {
  comments: QuizComment[];
  total: number;
}

const COMMENT_SELECT = 'id, body, created_at, author:profiles(username, display_name, avatar_url)';

const commentSchema = z.object({
  quizId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

/** Comentar es barato pero spam-able: 5 por IP cada 10 minutos. */
const commentLimiter = createRateLimiter('quiz-comment', 5, 600);

/** Falls back to `x-real-ip` when the proxy chain is missing. */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headerList.get('x-real-ip') ?? 'unknown';
}

const EMPTY_PAGE: QuizCommentsPage = { comments: [], total: 0 };

/**
 * Últimos 50 comentarios de un quiz publicado + total real. Sin auth: la RLS
 * ya permite leer. Cualquier fallo devuelve página vacía — la ficha nunca se
 * rompe por esto.
 */
export async function getQuizComments(quizId: string): Promise<QuizCommentsPage> {
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return EMPTY_PAGE;

  try {
    const supabase = await createClient();
    const { data, count, error } = await supabase
      .from('quiz_comments')
      .select(COMMENT_SELECT, { count: 'exact' })
      .eq('quiz_id', parsed.data)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return EMPTY_PAGE;
    return {
      comments: data.map((row) => ({
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author: row.author ?? null,
      })),
      total: count ?? data.length,
    };
  } catch {
    return EMPTY_PAGE;
  }
}

export async function createComment(
  quizId: string,
  body: string
): Promise<ActionResult<{ comment: QuizComment }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to comment.');

  const parsed = commentSchema.safeParse({ quizId, body });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { allowed } = await commentLimiter.check(await clientIp());
  if (!allowed) return actionFailure('rate_limited', 'Too many comments. Please wait.');

  // The INSERT policy only checks ownership: without this look-up an
  // authenticated caller could comment on drafts/pending quizzes and still
  // fire the notification trigger.
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('id', parsed.data.quizId)
    .eq('status', 'published')
    .maybeSingle();
  if (!quiz) return actionFailure('not_found', 'Quiz not found.');

  const { data, error } = await supabase
    .from('quiz_comments')
    .insert({ quiz_id: parsed.data.quizId, user_id: user.id, body: parsed.data.body })
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) {
    return actionFailure('unexpected', error?.message ?? 'Could not post the comment.');
  }

  return {
    success: true,
    comment: { id: data.id, body: data.body, created_at: data.created_at, author: data.author },
  };
}
