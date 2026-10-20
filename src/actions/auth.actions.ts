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
import { SITE_URL } from '@/lib/seo/site';
import {
  PasswordResetRequestSchema,
  PasswordUpdateSchema,
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
 * Tras un cambio de clave revoca las demás sesiones; `scope: 'others'` conserva
 * la actual. Si falla, la clave igualmente quedó cambiada: no se reintenta, se
 * reporta en el resultado para que la UI no prometa un cierre que no hubo.
 */
async function revokeOtherSessions(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    return !error;
  } catch {
    return false;
  }
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

/**
 * Envía el correo de recuperación. El enlace vuelve por `/callback`, que
 * canjea el código y aterriza en `/{locale}/reset-password`. Responde igual
 * exista o no la cuenta: el resultado no puede filtrar si el email está
 * registrado (Supabase tampoco lo distingue).
 */
export async function forgotPasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = PasswordResetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, locale } = parsed.data;
  const { allowed } = await authLimiter.check(`forgot:${identifierFor(email)}`);
  if (!allowed) return { ok: false, code: 'rate_limited' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });

  if (error) return { ok: false, code: mapAuthError(error) };
  return { ok: true, userId: null };
}

/**
 * Nueva contraseña tras el enlace de recuperación. Lo que autoriza el cambio
 * es la sesión que creó `/callback` al canjear el código del correo; sin esa
 * sesión la acción no toca la cuenta.
 */
export async function resetPasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = PasswordUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthorized' };

  const { allowed } = await authLimiter.check(`pwreset:${user.id}`);
  if (!allowed) return { ok: false, code: 'rate_limited' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, code: mapAuthError(error) };
  return { ok: true, userId: user.id, revokedOtherSessions: await revokeOtherSessions(supabase) };
}

/**
 * Cambio de contraseña con sesión normal (/settings). Si la cuenta ya tiene
 * identidad por email se revalida la clave vigente antes de reemplazarla: una
 * sesión abierta en un equipo ajeno no basta para tomar la cuenta, y al cambiar
 * la clave esa sesión además queda revocada. Quien entró solo por OAuth no
 * tiene clave que revalidar y define la primera aquí.
 */
export async function changePasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = PasswordUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, code: 'unauthorized' };

  const { allowed } = await authLimiter.check(`pwchange:${user.id}`);
  if (!allowed) return { ok: false, code: 'rate_limited' };

  const hasEmailIdentity =
    user.identities?.some((identity) => identity.provider === 'email') ?? false;
  if (hasEmailIdentity) {
    const { currentPassword } = parsed.data;
    if (!currentPassword) {
      return {
        ok: false,
        code: 'invalid_input',
        fieldErrors: { currentPassword: ['required'] },
      };
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthError) return { ok: false, code: 'invalid_credentials' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, code: mapAuthError(error) };
  return { ok: true, userId: user.id, revokedOtherSessions: await revokeOtherSessions(supabase) };
}
