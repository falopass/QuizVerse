/**
 * Supabase Server Client
 * Se usa en Server Components y Server Actions
 * Maneja cookies automáticamente
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Las cookies se pueden setear desde Server Components
          // Ignorar error si estamos en un contexto que no lo permite
        }
      },
    },
  });
}
