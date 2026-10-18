'use server';

/**
 * Edición del perfil propio.
 *
 * Solo se puede tocar la fila de `auth.uid()`: la RLS de `profiles` ya lo exige,
 * y aquí se comprueba antes para devolver un error de dominio en vez de un
 * update silencioso de 0 filas.
 */

import { createClient } from '@/lib/supabase/server';
import { apiLimiter } from '@/lib/utils/rate-limit';
import {
  ProfileUpdateSchema,
  toProfileUpdate,
  type ProfileActionResult,
} from '@/lib/profile/schema';

export async function updateProfileAction(input: unknown): Promise<ProfileActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, code: 'unauthorized' };

  const { allowed } = await apiLimiter.check(`profile:${user.id}`);
  if (!allowed) return { ok: false, code: 'unexpected' };

  const parsed = ProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const update = toProfileUpdate(parsed.data);
  if (Object.keys(update).length === 0) return { ok: false, code: 'empty' };

  if (typeof update.username === 'string') {
    const { data: taken } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', update.username)
      .neq('id', user.id)
      .limit(1);

    if ((taken as unknown[] | null)?.length) {
      return { ok: false, code: 'username_taken', fieldErrors: { username: ['taken'] } };
    }
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return { ok: false, code: 'unexpected' };

  return { ok: true };
}
