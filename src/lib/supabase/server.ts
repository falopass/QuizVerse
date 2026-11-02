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
    // `httpOnly: false` es estructural de Supabase: el browser client lee las
    // cookies `sb-*` vía document.cookie para refrescar la sesión. Lo que sí se
    // puede endurecer es `secure` (solo HTTPS en producción); el resto de
    // defaults de @supabase/ssr (path '/', sameSite 'lax') ya van bien.
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
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
