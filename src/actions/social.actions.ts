'use server';

/**
 * Seguir y dejar de seguir jugadores.
 *
 * Única puerta de escritura de `user_follows`: la RLS ya exige que
 * `follower_id` sea el usuario autenticado y el trigger
 * `trg_update_follow_counts` mantiene `followers_count`/`following_count`
 * de `profiles`. El ranking de amigos (`/api/leaderboard?scope=friends`)
 * lee esta misma tabla.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { locales } from '@/lib/i18n/dictionaries';
import { apiLimiter } from '@/lib/utils/rate-limit';

const ToggleFollowSchema = z.object({
  targetUserId: z.string().uuid(),
  follow: z.boolean(),
});

export type FollowActionResult =
  | { ok: true }
  | { ok: false; code: 'unauthorized' | 'invalid_input' | 'unexpected' };

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

  const { allowed } = await apiLimiter.check(`follow:${user.id}`);
  if (!allowed) return { ok: false, code: 'unexpected' };

  if (parsed.data.follow) {
    const { error } = await supabase.from('user_follows').insert({
      follower_id: user.id,
      following_id: parsed.data.targetUserId,
    });
    // 23505 (PK duplicada): ya lo sigue, el estado pedido ya existe.
    if (error && error.code !== '23505') return { ok: false, code: 'unexpected' };
  } else {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', parsed.data.targetUserId);
    if (error) return { ok: false, code: 'unexpected' };
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
