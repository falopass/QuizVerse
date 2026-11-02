/**
 * Supabase público, sin cookies.
 *
 * Las lecturas de catálogo se cachean entre requests con `unstable_cache`, y
 * dentro de una entrada de caché no se puede leer la request (cookies). Estas
 * consultas van con la anon key y sin sesión: RLS decide con el rol `anon`,
 * igual que un visitante anónimo. Nada que dependa del usuario puede pasar
 * por aquí; para eso está `createClient()` de `./server`.
 */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

export function createPublicClient() {
  const { url, anonKey } = supabaseEnv();

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
