'use server';

/**
 * Acciones de autenticación.
 *
 * Toda la validación vive en `@/lib/auth/identity`; aquí solo hay orquestación:
 * límite de intentos, llamada a Supabase y traducción del error a un código
 * estable. El cliente nunca recibe el mensaje crudo del proveedor.
 */

import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { authLimiter } from '@/lib/utils/rate-limit';
import {
  SignInSchema,
  SignUpSchema,
  mapAuthError,
  normalizeUsername,
  type AuthResult,
} from '@/lib/auth/identity';

/** El email no se guarda en claro como clave de rate limit. */
function identifierFor(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 32);
}

/**
 * Crea la cuenta. Manda al trigger `handle_new_user` el nombre y un username ya
 * normalizado; el trigger vuelve a sanear y resuelve colisiones con el UUID.
 */
export async function signUpAction(input: unknown): Promise<AuthResult> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password, name } = parsed.data;
  const { allowed } = await authLimiter.check(`signup:${identifierFor(email)}`);
  if (!allowed) return { ok: false, code: 'rate_limited' };

  const displayName = name ?? email.split('@')[0];
  const base = parsed.data.username
    ? normalizeUsername(parsed.data.username)
    : normalizeUsername(displayName);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        // El trigger lee `name`; `display_name` se mantiene por compatibilidad
        // con el formulario antiguo, que solo mandaba esa clave.
        name: displayName,
        display_name: displayName,
        username: base,
      },
    },
  });

  if (error) return { ok: false, code: mapAuthError(error) };
  return { ok: true, userId: data.user?.id ?? null };
}

/** Inicia sesión con email y contraseña. */
export async function signInAction(input: unknown): Promise<AuthResult> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const { allowed } = await authLimiter.check(`signin:${identifierFor(email)}`);
  if (!allowed) return { ok: false, code: 'rate_limited' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { ok: false, code: mapAuthError(error) };
  return { ok: true, userId: data.user?.id ?? null };
}

/** Cierra la sesión en el servidor y borra las cookies de Supabase. */
export async function signOutAction(): Promise<AuthResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true, userId: null };
}
