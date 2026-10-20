import 'server-only';

/**
 * Guardia de moderación: resuelve la sesión y si el perfil es admin.
 *
 * `is_admin` solo lo escribe service role o un admin previo (trigger
 * `guard_profile_admin_flag`, migración 010), así que leerlo del perfil basta.
 * Quien llama decide la respuesta: las páginas admin reparten entre redirect a
 * login y 404, y las acciones devuelven `unauthorized`/`forbidden`.
 */

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface AdminSession {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  isAdmin: boolean;
}

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  return { supabase, user, isAdmin: profile?.is_admin === true };
}
