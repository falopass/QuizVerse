/**
 * Supabase Browser Client
 * Se usa en el lado del cliente (componentes, hooks)
 */

import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

export function createClient() {
  const { url, anonKey } = supabaseEnv();

  return createBrowserClient<Database>(url, anonKey, {
    // Las cookies que escribe desde document.cookie llevan Secure en
    // producción; httpOnly no es posible (esta misma lectura las necesita).
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  });
}
