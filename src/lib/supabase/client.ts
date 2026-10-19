/**
 * Supabase Browser Client
 * Se usa en el lado del cliente (componentes, hooks)
 */

import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

export function createClient() {
  const { url, anonKey } = supabaseEnv();

  return createBrowserClient<Database>(url, anonKey);
}
