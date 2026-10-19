'use server';

/**
 * Acciones de moderación.
 *
 * `quiz_reports` entra por el endpoint público /api/quiz/report y lo resuelve
 * un admin desde /{locale}/admin/reportes. La policy `quiz_reports_update_admin`
 * ya limita el UPDATE en la base; el guard explícito de aquí devuelve
 * `unauthorized`/`forbidden` limpio en vez de un error de Postgres.
 */

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { actionFailure, zodMessage, type ActionResult } from '@/lib/actions/types';

const ResolveSchema = z.object({ reportId: z.string().uuid() });

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

  if (error) return actionFailure('unexpected', error.message);
  return { success: true };
}
