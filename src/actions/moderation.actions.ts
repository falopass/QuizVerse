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
import { generateUniqueSlug, isProvisionalSlug } from '@/lib/quiz/quiz-slug';
import type { QuizStatus } from '@/types/database';

const ResolveSchema = z.object({ reportId: z.string().uuid() });
/**
 * IDs de los reportes que la ficha mostró: solo esos se cierran con el
 * veredicto. Sin tope artificial — un quiz con cientos de reportes sigue
 * siendo moderable; el UPDATE va por lotes para no reventar la URL.
 */
const ReportIdsSchema = z.array(z.string().uuid()).default([]);
const ModerateSchema = z.object({ quizId: z.string().uuid(), reportIds: ReportIdsSchema });
/** PostgREST manda los filtros en la URL: ~100 UUID por UPDATE evita el límite. */
const REPORT_IDS_PER_UPDATE = 100;
/** Reintentos del UPDATE si el slug definitivo choca con la unique constraint. */
const SLUG_ATTEMPTS = 5;
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
 * Solo se resuelven los reportes que el admin vio: la ficha manda sus IDs y
 * aquí se cierran con el veredicto. Un reporte creado después de cargar la
 * ficha, o que no se mostró, sigue abierto para revisión.
 */
async function moderateQuiz(
  quizId: string,
  next: Extract<QuizStatus, 'published' | 'rejected'>,
  note: string | null,
  reportIds: string[]
): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return actionFailure('unauthorized', 'Sign in to moderate quizzes.');
  if (!isAdmin) return actionFailure('forbidden', 'Only admins can moderate quizzes.');

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, slug, title, language, status')
    .eq('id', quizId)
    .maybeSingle();
  if (!quiz) return actionFailure('not_found', 'Quiz not found.');
  if (quiz.status === next) return { success: true };
  const allowed = next === 'published' ? PUBLISHABLE : REJECTABLE;
  if (!allowed.includes(quiz.status)) {
    return actionFailure('conflict', `A ${quiz.status} quiz cannot be ${next} from here.`);
  }

  // El slug definitivo nace al publicar. Al crear, el quiz sin publicar lleva
  // uno provisional (`base--<aleatorio>`, ver provisionalSlug): resolver la
  // colisión en ese momento revelaría si el slug base pertenece a un borrador
  // o pendiente de otro usuario. Aquí el admin ve todas las filas, así que la
  // sonda es total y el sufijo secuencial no filtra nada nuevo. Un quiz que ya
  // tuvo slug limpio (rechazado y republicado) lo conserva: sus enlaces
  // compartidos a /quiz, /play y /result siguen vivos.
  const takenSlugs = new Set<string>();
  const now = new Date().toISOString();
  const renaming = next === 'published' && isProvisionalSlug(quiz.slug);
  let slug = quiz.slug;
  let updated: { id: string }[] | null = null;
  let error: { code?: string; message: string } | null = null;
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    if (renaming) {
      slug = await generateUniqueSlug(quiz.title, {
        language: quiz.language ?? undefined,
        exists: async (candidate) => {
          if (takenSlugs.has(candidate)) return true;
          const { data } = await supabase
            .from('quizzes')
            .select('id')
            .eq('slug', candidate)
            .neq('id', quiz.id)
            .maybeSingle();
          return Boolean(data);
        },
      });
    }
    const result = await supabase
      .from('quizzes')
      .update({
        status: next,
        moderated_by: user.id,
        moderated_at: now,
        moderation_note: note,
        ...(renaming
          ? { published_at: now, slug }
          : next === 'published'
            ? { published_at: now }
            : {}),
      })
      .eq('id', quiz.id)
      .eq('status', quiz.status)
      .select('id');
    updated = result.data;
    error = result.error;
    // 23505: otra fila tomó el slug entre la sonda y el UPDATE (dos admins
    // publicando a la vez). Se reintenta con el sufijo siguiente.
    if (error?.code !== '23505') break;
    takenSlugs.add(slug);
  }

  if (error) {
    // PGRST204: las columnas moderated_* no existen — migración 016 sin aplicar.
    if (error.code === 'PGRST204') {
      return actionFailure(
        'conflict',
        'The quiz could not be moderated: the admin update policy or migration 016 is missing.'
      );
    }
    return unexpectedFailure('moderation.moderate', error);
  }
  if (!updated || updated.length === 0) {
    return actionFailure(
      'conflict',
      'The quiz could not be moderated: it changed state or the admin update policy is missing (migration 016).'
    );
  }

  // Best effort: el veredicto ya quedó; un fallo aquí solo deja reportes abiertos.
  // El `.eq('quiz_id')` valida en servidor que cada ID pertenece a este quiz:
  // IDs de otro quiz no cierran nada. Por lotes para no exceder la URL.
  const resolvedAt = new Date().toISOString();
  for (let i = 0; i < reportIds.length; i += REPORT_IDS_PER_UPDATE) {
    await supabase
      .from('quiz_reports')
      .update({ resolved: true, resolved_by: user.id, resolved_at: resolvedAt })
      .in('id', reportIds.slice(i, i + REPORT_IDS_PER_UPDATE))
      .eq('quiz_id', quiz.id)
      .eq('resolved', false);
  }

  revalidateQuizPages(quiz.language, slug);
  // Un rechazado que vuelve al catálogo puede cambiar de slug: el anterior
  // pudo quedar cacheado en CDN mientras estuvo publicado.
  if (slug !== quiz.slug) revalidateQuizPages(quiz.language, quiz.slug);
  revalidateCatalogFeeds(quiz.language);
  revalidatePath('/[locale]/admin/moderacion', 'page');
  return { success: true };
}

/**
 * Aprueba un quiz pendiente (o rehabilita uno rechazado).
 *
 * `reportIds` son los reportes abiertos que la ficha mostró al admin; solo
 * esos quedan resueltos con el veredicto.
 */
export async function publishQuiz(quizId: string, reportIds: string[] = []): Promise<ActionResult> {
  const parsed = ModerateSchema.safeParse({ quizId, reportIds });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));
  return moderateQuiz(parsed.data.quizId, 'published', null, parsed.data.reportIds);
}

/** Rechaza un quiz con motivo: lo saca del catálogo y se lo explica al creador. */
export async function rejectQuiz(
  quizId: string,
  reason: string,
  reportIds: string[] = []
): Promise<ActionResult> {
  const parsed = RejectSchema.safeParse({ quizId, reason, reportIds });
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));
  return moderateQuiz(parsed.data.quizId, 'rejected', parsed.data.reason, parsed.data.reportIds);
}
