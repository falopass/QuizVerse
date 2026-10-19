'use server';

/**
 * Notificaciones del usuario.
 *
 * La tabla `notifications` y su RLS existen desde la migración 007: la lectura
 * y el UPDATE ya quedan limitados a las filas propias por las políticas, así
 * que aquí no hace falta filtrar por `user_id` otra vez.
 */

import { createClient } from '@/lib/supabase/server';
import { actionFailure, type ActionResult } from '@/lib/actions/types';

/** Reads the authenticated user, or `null`. */
async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Marca como leídas todas las notificaciones pendientes del usuario. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to read your notifications.');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error) return actionFailure('unexpected', error.message);
  return { success: true };
}
