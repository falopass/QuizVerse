/**
 * Cliente Supabase con service role — SOLO servidor.
 *
 * La migración 015 mueve la clave de respuestas a `quiz_answer_keys`, tabla
 * que solo service_role puede leer. Este cliente existe para esa lectura y
 * para el borrado de cuentas (`auth.admin`, que no vive en el cliente SSR);
 * no se usa para lecturas públicas ni se expone a componentes cliente.
 *
 * Devuelve `null` cuando la variable no está configurada (deploys anteriores
 * a la clave). El lector de claves cae entonces al cliente SSR normal, que es
 * lo correcto mientras la migración no se aplica; el borrado de cuentas falla
 * con un código `unavailable`, porque `auth.admin` no existe sin service role.
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
