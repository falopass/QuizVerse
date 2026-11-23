'use server';

/**
 * Seguir y dejar de seguir jugadores.
 *
 * Única puerta de escritura de `user_follows`: valida sesión, impide
 * auto-seguimiento y aplica `socialLimiter`. Con la migración 024 aplicada,
 * `anon`/`authenticated` ya no pueden mutar `user_follows` directamente por
 * PostgREST y solo el escritor validado (service role) inserta o borra; si
 * falta la clave de servicio (tests/entornos sin 024), cae al cliente SSR.
 *
 * Los triggers `trg_update_follow_counts` y `trg_notify_follow` (deduplicado
 * en 024) mantienen `followers_count`/`following_count` y evitan notificaciones
 * repetidas por el mismo par.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { locales } from '@/lib/i18n/dictionaries';
import { socialLimiter } from '@/lib/utils/rate-limit';

const ToggleFollowSchema = z.object({
  targetUserId: z.string().uuid(),
  follow: z.boolean(),
});

export type FollowActionResult =
  | { ok: true }
  | { ok: false; code: 'unauthorized' | 'invalid_input' | 'rate_limited' | 'unexpected' };

export async function toggleFollowAction(
  targetUserId: string,
  follow: boolean
): Promise<FollowActionResult> {
  const parsed = ToggleFollowSchema.safeParse({ targetUserId, follow });
  if (!parsed.success) return { ok: false, code: 'invalid_input' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Seguirse a uno mismo se rechaza con el mismo código que la falta de sesión.
  if (!user || user.id === parsed.data.targetUserId) {
    return { ok: false, code: 'unauthorized' };
  }

  const limit = await socialLimiter.check(`follow:${user.id}`);
  if (limit.errored && !limit.allowed) {
    console.error('[action:social.rate_limit] backend unavailable');
    return { ok: false, code: 'unexpected' };
  }
  // El código propio deja que el botón distinga «espera» de «algo se rompió».
  if (!limit.allowed) return { ok: false, code: 'rate_limited' };

  const writer = createServiceClient() ?? supabase;

  if (parsed.data.follow) {
    const { error } = await writer.from('user_follows').insert({
      follower_id: user.id,
      following_id: parsed.data.targetUserId,
    });
    // 23505 (PK duplicada): ya lo sigue, el estado pedido ya existe.
    if (error && error.code !== '23505') {
      console.error('[action:social.follow]', error);
      return { ok: false, code: 'unexpected' };
    }
  } else {
    const { error } = await writer
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', parsed.data.targetUserId);
    if (error) {
      console.error('[action:social.unfollow]', error);
      return { ok: false, code: 'unexpected' };
    }
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', parsed.data.targetUserId)
    .maybeSingle();

  if (target?.username) {
    for (const locale of locales) {
      revalidatePath(`/${locale}/profile/${target.username}`);
    }
  }

  return { ok: true };
}
