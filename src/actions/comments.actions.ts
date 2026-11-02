'use server';

/**
 * Comentarios de la ficha del quiz.
 *
 * La tabla `quiz_comments` y su RLS existen desde la migración 005: lectura
 * pública en quizzes publicados y escritura solo del propio usuario
 * autenticado. El trigger `trg_notify_comment` (migración 007) avisa al creador
 * del quiz al insertar; aquí solo se escribe la fila.
 *
 * La moderación (migración 017) añade tres vías, todas autorizadas en el
 * servidor además de la RLS:
 *   * `deleteComment` — el autor borra el suyo; el admin borra cualquiera.
 *   * `setCommentHidden` — el creador del quiz (y el admin) ocultan o
 *     restauran sin borrar; `hidden_at` lo filtra la lectura pública.
 *   * `reportComment` — cualquier usuario con sesión reporta con motivo; la
 *     copia del cuerpo queda en `comment_reports` como evidencia.
 * `resolveCommentReport` vive aquí y no en moderation.actions para no pisar la
 * cola de quizzes que se construye en paralelo.
 *
 * La ficha es estática: estas actions corren desde el cliente y nunca llaman
 * `revalidatePath`.
 */

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import {
  actionFailure,
  unexpectedFailure,
  zodMessage,
  type ActionResult,
} from '@/lib/actions/types';
import { requireAdmin } from '@/lib/auth/require-admin';
import type { ReportReason } from '@/types/database';

export interface QuizCommentAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface QuizComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  hidden_at: string | null;
  author: QuizCommentAuthor | null;
}

export interface QuizCommentsPage {
  comments: QuizComment[];
  total: number;
  /** Quien mira puede ocultar/mostrar: es el creador del quiz o admin. */
  viewerCanModerate: boolean;
  /** El admin además borra comentarios ajenos desde la ficha. */
  viewerIsAdmin: boolean;
}

const COMMENT_SELECT =
  'id, body, created_at, user_id, author:profiles(username, display_name, avatar_url)';

const commentSchema = z.object({
  quizId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

const hideSchema = z.object({
  commentId: z.string().uuid(),
  hidden: z.boolean(),
});

const reportSchema = z.object({
  commentId: z.string().uuid(),
  reason: z.enum(['inappropriate', 'spam', 'incorrect_info', 'hate_speech', 'copyright', 'other']),
  details: z.string().max(1000).optional(),
});

const uuidSchema = z.string().uuid();

/** Comentar es barato pero spam-able: 5 por IP cada 10 minutos. */
const commentLimiter = createRateLimiter('quiz-comment', 5, 600);
/** Reportar exige sesión: el límite va por usuario, no por IP. */
const commentReportLimiter = createRateLimiter('comment-report', 8, 600);

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

const EMPTY_PAGE: QuizCommentsPage = {
  comments: [],
  total: 0,
  viewerCanModerate: false,
  viewerIsAdmin: false,
};

interface CommentViewerRole {
  isAdmin: boolean;
  isQuizCreator: boolean;
}

/** Rol del que mira frente a un comentario: admin global o dueño del quiz. */
async function commentViewerRole(
  supabase: Supabase,
  userId: string,
  quizId: string
): Promise<CommentViewerRole> {
  const [quizRes, profileRes] = await Promise.all([
    supabase.from('quizzes').select('creator_id').eq('id', quizId).maybeSingle(),
    supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
  ]);
  return {
    isAdmin: profileRes.data?.is_admin === true,
    isQuizCreator: quizRes.data?.creator_id === userId,
  };
}

async function isAdminUser(supabase: Supabase, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return data?.is_admin === true;
}

/**
 * Últimos 50 comentarios de un quiz publicado + total real. La RLS decide qué
 * filas ve cada quien: los ocultos solo llegan a moderación y a su autor.
 * Los fallos de la consulta rechazan para que el componente pueda distinguir
 * el error del vacío real y ofrecer reintento — solo un quizId inválido
 * devuelve página vacía.
 */
export async function getQuizComments(quizId: string): Promise<QuizCommentsPage> {
  const parsed = z.string().uuid().safeParse(quizId);
  if (!parsed.success) return EMPTY_PAGE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user
    ? await commentViewerRole(supabase, user.id, parsed.data)
    : { isAdmin: false, isQuizCreator: false };
  const canModerate = role.isAdmin || role.isQuizCreator;

  const { data, count, error } = await supabase
    .from('quiz_comments')
    .select(COMMENT_SELECT, { count: 'exact' })
    .eq('quiz_id', parsed.data)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) throw error ?? new Error('Could not load comments');

  // `hidden_at` nace en la migración 017: si aún no se aplicó, esta consulta
  // falla y todo se pinta visible en vez de romper la sección. Solo la piden
  // los moderadores; el público no la necesita (la RLS ya filtró).
  const hiddenById = new Map<string, string>();
  if (canModerate && data.length > 0) {
    const { data: hiddenRows } = await supabase
      .from('quiz_comments')
      .select('id, hidden_at')
      .eq('quiz_id', parsed.data)
      .not('hidden_at', 'is', null);
    for (const row of hiddenRows ?? []) {
      if (row.hidden_at) hiddenById.set(row.id, row.hidden_at);
    }
  }

  return {
    comments: data.map((row) => ({
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      user_id: row.user_id,
      hidden_at: hiddenById.get(row.id) ?? null,
      author: row.author ?? null,
    })),
    total: count ?? data.length,
    viewerCanModerate: canModerate,
    viewerIsAdmin: role.isAdmin,
  };
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
    return unexpectedFailure('comments.create', error);
  }

  return {
    success: true,
    comment: {
      id: data.id,
      body: data.body,
      created_at: data.created_at,
      user_id: data.user_id,
      hidden_at: null,
      author: data.author,
    },
  };
}

/**
 * Borra un comentario: el autor borra el suyo y el admin borra cualquiera.
 * La RLS repite la misma regla en la base; el chequeo explícito devuelve
 * `forbidden` limpio en vez de un "0 filas" ambiguo.
 */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(commentId);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to manage comments.');

  const { data: comment } = await supabase
    .from('quiz_comments')
    .select('id, user_id')
    .eq('id', parsed.data)
    .maybeSingle();
  if (!comment) return actionFailure('not_found', 'Comment not found.');

  if (comment.user_id !== user.id && !(await isAdminUser(supabase, user.id))) {
    return actionFailure('forbidden', 'You can only delete your own comments.');
  }

  const { error } = await supabase.from('quiz_comments').delete().eq('id', comment.id);
  if (error) return unexpectedFailure('comments.delete', error);
  return { success: true };
}

/**
 * Oculta o restaura un comentario: lo decide el creador del quiz o un admin.
 * La policy `quiz_comments_update_quiz_creator`/`_admin` y el trigger
 * `guard_comment_moderation` limitan el cambio a las columnas de ocultado.
 */
export async function setCommentHidden(
  commentId: string,
  hidden: boolean
): Promise<ActionResult<{ hiddenAt: string | null }>> {
  const parsed = hideSchema.safeParse({ commentId, hidden });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to manage comments.');

  const { data: comment } = await supabase
    .from('quiz_comments')
    .select('id, quiz_id')
    .eq('id', parsed.data.commentId)
    .maybeSingle();
  if (!comment) return actionFailure('not_found', 'Comment not found.');

  const role = await commentViewerRole(supabase, user.id, comment.quiz_id);
  if (!role.isAdmin && !role.isQuizCreator) {
    return actionFailure('forbidden', 'Only the quiz creator or an admin can hide comments.');
  }

  const hiddenAt = parsed.data.hidden ? new Date().toISOString() : null;
  const { error } = await supabase
    .from('quiz_comments')
    .update({
      hidden_at: hiddenAt,
      hidden_by: parsed.data.hidden ? user.id : null,
    })
    .eq('id', comment.id);
  if (error) return unexpectedFailure('comments.hide', error);
  return { success: true, hiddenAt };
}

/**
 * Reporta un comentario: cualquier usuario con sesión, con motivo y detalle
 * opcional. Guarda una copia del cuerpo y del quiz para que la cola de
 * moderación conserve la evidencia aunque el comentario se borre después.
 */
export async function reportComment(
  commentId: string,
  reason: string,
  details?: string
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse({ commentId, reason, details });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to report a comment.');

  const { allowed } = await commentReportLimiter.check(user.id);
  if (!allowed) return actionFailure('rate_limited', 'Too many reports. Please wait.');

  const { data: comment } = await supabase
    .from('quiz_comments')
    .select('id, quiz_id, body')
    .eq('id', parsed.data.commentId)
    .maybeSingle();
  if (!comment) return actionFailure('not_found', 'Comment not found.');

  const { error } = await supabase.from('comment_reports').insert({
    comment_id: comment.id,
    quiz_id: comment.quiz_id,
    comment_body: comment.body,
    reporter_id: user.id,
    reason: parsed.data.reason as ReportReason,
    details: parsed.data.details?.trim() || null,
  });
  if (error) {
    if (error.code === '23505') {
      return actionFailure('conflict', 'You already reported this comment.');
    }
    return unexpectedFailure('comments.report', error);
  }
  return { success: true };
}

/** Marca un reporte de comentario como revisado; `.eq('resolved', false)` lo hace idempotente. */
export async function resolveCommentReport(reportId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(reportId);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return actionFailure('unauthorized', 'Sign in to moderate reports.');
  if (!isAdmin) return actionFailure('forbidden', 'Only admins can resolve reports.');

  const { error } = await supabase
    .from('comment_reports')
    .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('resolved', false);
  if (error) return unexpectedFailure('comments.resolve-report', error);
  return { success: true };
}
