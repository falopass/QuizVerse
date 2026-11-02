'use server';

/**
 * Acciones de moderación.
 *
 * `quiz_reports` entra por el endpoint público /api/quiz/report y lo resuelve
 * un admin desde /{locale}/admin/reportes. La cola de quizzes pendientes vive
 * en /{locale}/admin/moderacion y la ficha de revisión en
 * /{locale}/admin/quizzes/[id]; publicar y rechazar pasan por aquí.
 *
 * La autorización va por delante de la DB: `requireAdmin` devuelve
 * `unauthorized`/`forbidden` limpio en vez de un error de Postgres, y detrás
 * quedan la policy `quizzes_update_admin` (migración 016) para el UPDATE y el
 * trigger `guard_quiz_publication` (010) para la publicación. La notificación
 * al creador la emite `trg_notify_quiz_moderation` (016) en la propia
 * transición de estado.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  actionFailure,
  unexpectedFailure,
  zodMessage,
  type ActionResult,
} from '@/lib/actions/types';
import { revalidateCatalogFeeds, revalidateQuizPages } from '@/lib/quiz/revalidate';
import type { QuizStatus } from '@/types/database';

const ResolveSchema = z.object({ reportId: z.string().uuid() });
const ModerateSchema = z.object({ quizId: z.string().uuid() });
const RejectSchema = ModerateSchema.extend({ reason: z.string().trim().min(3).max(500) });

/** Publicar solo alcanza lo que espera veredicto (pending) o lo apela (rejected). */
const PUBLISHABLE: readonly QuizStatus[] = ['pending', 'rejected'];
/**
 * Rechazar también sirve de takedown sobre lo publicado y confirma el retiro
 * de lo archivado (resuelve sus reportes sin republicarlo). Un draft nunca
 * llegó a la cola y un published no puede "re-publicarse" por aquí.
 */
const REJECTABLE: readonly QuizStatus[] = ['pending', 'published', 'archived'];

/** Marca un reporte como revisado. El `.eq('resolved', false)` lo hace idempotente. */
export async function resolveQuizReport(reportId: string): Promise<ActionResult> {
  const parsed = ResolveSchema.safeParse({ reportId });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return actionFailure('unauthorized', 'Sign in to moderate reports.');
  if (!isAdmin) return actionFailure('forbidden', 'Only admins can resolve reports.');

  const { error } = await supabase
    .from('quiz_reports')
    .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', parsed.data.reportId)
    .eq('resolved', false);

  if (error) return unexpectedFailure('moderation.resolve', error);
  return { success: true };
}

/**
 * Cambia el estado de un quiz como admin y deja el rastro de quién decidió.
 *
 * El `.eq('status', quiz.status)` hace el cambio compare-and-swap: si otro
 * admin (o el dueño) movió el quiz entre la lectura y el UPDATE, no se pisa
 * nada y se devuelve `conflict`. `.select('id')` distingue además el caso en
 * que la migración 016 no está aplicada: sin `quizzes_update_admin` la policy
 * filtra la fila y PostgREST devuelve 0 filas sin error.
 *
 * Los reportes abiertos del quiz quedan resueltos por el mismo veredicto —
 * revisar el contenido y actuar sobre él ES la resolución del reporte.
 */
async function moderateQuiz(
  quizId: string,
  next: Extract<QuizStatus, 'published' | 'rejected'>,
  note: string | null
): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return actionFailure('unauthorized', 'Sign in to moderate quizzes.');
  if (!isAdmin) return actionFailure('forbidden', 'Only admins can moderate quizzes.');

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, slug, language, status')
    .eq('id', quizId)
    .maybeSingle();
  if (!quiz) return actionFailure('not_found', 'Quiz not found.');
  if (quiz.status === next) return { success: true };
  const allowed = next === 'published' ? PUBLISHABLE : REJECTABLE;
  if (!allowed.includes(quiz.status)) {
    return actionFailure('conflict', `A ${quiz.status} quiz cannot be ${next} from here.`);
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('quizzes')
    .update({
      status: next,
      moderated_by: user.id,
      moderated_at: now,
      moderation_note: note,
      ...(next === 'published' ? { published_at: now } : {}),
    })
    .eq('id', quiz.id)
    .eq('status', quiz.status)
    .select('id');

  if (error) {
    // PGRST204: las columnas moderated_* no existen — migración 016 sin aplicar.
    const code = error.code === 'PGRST204' ? 'conflict' : 'unexpected';
    return actionFailure(code, error.message);
  }
  if (!updated || updated.length === 0) {
    return actionFailure(
      'conflict',
      'The quiz could not be moderated: it changed state or the admin update policy is missing (migration 016).'
    );
  }

  // Best effort: el veredicto ya quedó; un fallo aquí solo deja reportes abiertos.
  await supabase
    .from('quiz_reports')
    .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('quiz_id', quiz.id)
    .eq('resolved', false);

  revalidateQuizPages(quiz.language, quiz.slug);
  revalidateCatalogFeeds(quiz.language);
  revalidatePath('/[locale]/admin/moderacion', 'page');
  return { success: true };
}

/** Aprueba un quiz pendiente (o rehabilita uno rechazado). */
export async function publishQuiz(quizId: string): Promise<ActionResult> {
  const parsed = ModerateSchema.safeParse({ quizId });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));
  return moderateQuiz(parsed.data.quizId, 'published', null);
}

/** Rechaza un quiz con motivo: lo saca del catálogo y se lo explica al creador. */
export async function rejectQuiz(quizId: string, reason: string): Promise<ActionResult> {
  const parsed = RejectSchema.safeParse({ quizId, reason });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));
  return moderateQuiz(parsed.data.quizId, 'rejected', parsed.data.reason);
}
