/**
 * Supabase Browser Client
 * Se usa en el lado del cliente (componentes, hooks)
 */

import {
  combineChunks,
  createBrowserClient,
  isChunkLike,
  parseCookieHeader,
  stringFromBase64URL,
} from '@supabase/ssr';
import { supabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

const BASE64_PREFIX = 'base64-';
// Mismo sufijo que el CHUNK_LIKE_REGEX de @supabase/ssr (`.0`, `.1`, …).
const CHUNK_SUFFIX_RE = /[.](0|[1-9][0-9]*)$/;

/**
 * Una cookie `sb-*` ilegible (prefijo `base64-` con contenido corrupto) hace
 * lanzar al SDK al decodificarla (`Invalid UTF-8 sequence`), con error en
 * consola y la sesión rota hasta borrar cookies a mano. El servidor ya lo
 * tolera desde #376 (src/proxy.ts); aquí se reproduce exactamente la lectura
 * del SDK — combinar los trozos de cada clave y decodificar el valor — y se
 * borra lo que no se pueda leer, así el cliente arranca como anónimo.
 */
async function dropUnreadableSupabaseCookies() {
  if (typeof document === 'undefined') return;

  const cookies = parseCookieHeader(document.cookie).filter(({ name }) => name.startsWith('sb-'));
  const valueOf = async (name: string) =>
    cookies.find((cookie) => cookie.name === name)?.value || null;

  for (const key of new Set(cookies.map(({ name }) => name.replace(CHUNK_SUFFIX_RE, '')))) {
    const stored = await combineChunks(key, valueOf);
    if (!stored?.startsWith(BASE64_PREFIX)) continue;
    try {
      stringFromBase64URL(stored.slice(BASE64_PREFIX.length));
      continue;
    } catch {
      // El SDK las escribe con path '/' y sin dominio: así se borran.
      for (const { name } of cookies.filter((cookie) => isChunkLike(cookie.name, key))) {
        document.cookie = `${name}=; Max-Age=0; Path=/`;
      }
    }
  }
}

export async function createClient() {
  const { url, anonKey } = supabaseEnv();

  await dropUnreadableSupabaseCookies();

  return createBrowserClient<Database>(url, anonKey, {
    // Las cookies que escribe desde document.cookie llevan Secure en
    // producción; httpOnly no es posible (esta misma lectura las necesita).
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  });
}
