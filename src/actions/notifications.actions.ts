'use server';

/**
 * Notificaciones del usuario.
 *
 * La tabla `notifications` y su RLS existen desde la migración 007. Las
 * políticas ya limitan las filas a las propias, pero el UPDATE filtra por
 * `user_id` igualmente: si una migración futura relaja la policy, esta
 * acción no puede tocar notificaciones de otra gente (mismo patrón que
 * `getMyActivity`).
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  actionFailure,
  unexpectedFailure,
  zodMessage,
  type ActionResult,
} from '@/lib/actions/types';

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
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return unexpectedFailure('notifications.markAllRead', error);
  return { success: true };
}

const notificationIdSchema = z.string().uuid();

/** Marca una notificación como leída al abrirla; no-op si ya lo estaba. */
export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { supabase, user } = await currentUser();
  if (!user) return actionFailure('unauthorized', 'Sign in to read your notifications.');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('id', parsed.data)
    .eq('is_read', false);

  if (error) return unexpectedFailure('notifications.markNotificationRead', error);
  return { success: true };
}
