/**
 * Cliente Supabase con service role — SOLO servidor.
 *
 * La migración 015 mueve la clave de respuestas a `quiz_answer_keys`, tabla
 * que solo service_role puede leer. Este cliente existe para esa lectura y
 * nada más: no se usa para lecturas públicas ni se expone a componentes
 * cliente.
 *
 * Devuelve `null` cuando la variable no está configurada (deploys anteriores
 * a la clave): el llamador cae al cliente SSR normal, que es lo correcto en
 * los estados donde la migración aún no se aplica.
 */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  const { url } = supabaseEnv();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
