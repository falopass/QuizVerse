/**
 * Identidad de cuenta: normalización del nombre de usuario, validación de
 * credenciales y contrato de resultado de las acciones de auth.
 *
 * El navegador no decide nada: los esquemas Zod viven aquí y las server actions
 * los aplican antes de tocar Supabase. La normalización replica el CHECK de la
 * tabla `profiles` (`^[a-z0-9_]{3,24}$`) para que el alta no falle en la base.
 */

import { z } from 'zod';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

/** Plegado ASCII: NFD separa los acentos y la clase los elimina. */
function foldToAscii(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convierte texto libre en un username válido.
 *
 * - Quita acentos y diacríticos (`José` → `jose`).
 * - Todo lo que no sea `[a-z0-9]` se vuelve `_`, sin repetir ni quedar en extremos.
 * - Recorta a 24 y rellena con `player` si queda por debajo del mínimo.
 */
export function normalizeUsername(input: string): string {
  const ascii = foldToAscii(input).toLowerCase();
  const collapsed = ascii
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, USERNAME_MAX);

  if (collapsed.length >= USERNAME_MIN) return collapsed;
  return collapsed.length === 0
    ? 'player'
    : collapsed.padEnd(USERNAME_MIN, '_').slice(0, USERNAME_MAX);
}

/**
 * Resuelve una colisión de username de forma determinista.
 *
 * `seed` suele ser el UUID del usuario; el sufijo sale de ahí, no de `Math.random`,
 * para que el mismo usuario produzca siempre el mismo candidato (testeable).
 */
export function withUsernameSuffix(base: string, seed: string, length = 4): string {
  const suffix = foldToAscii(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, Math.max(2, length));

  if (!suffix) return base;

  const room = USERNAME_MAX - suffix.length - 1;
  return `${base.slice(0, Math.max(USERNAME_MIN, room))}_${suffix}`;
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/** Email normalizado: sin espacios y en minúsculas antes de comparar o guardar. */
export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

/** 72 es el límite de bcrypt: más allá se truncaría en silencio. */
export const PasswordSchema = z.string().min(8, 'min').max(72, 'max');

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  /** Nombre visible; si falta se deriva de la parte local del email. */
  name: z.string().trim().min(1).max(60).optional(),
  /** Username explícito; si falta se normaliza `name`. */
  username: z.string().trim().max(USERNAME_MAX).optional(),
});

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(72),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;

export const AUTH_ERROR_CODES = [
  'invalid_input',
  'rate_limited',
  'email_taken',
  'invalid_credentials',
  'email_not_confirmed',
  'weak_password',
  'unexpected',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export type AuthResult =
  | { ok: true; userId: string | null }
  | {
      ok: false;
      code: AuthErrorCode;
      /** Errores por campo, solo para `invalid_input`. */
      fieldErrors?: Record<string, string[]>;
    };

/** Mapea el error de Supabase Auth a un código estable del dominio. */
export function mapAuthError(error: { code?: string; message?: string }): AuthErrorCode {
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  if (code.includes('already') || message.includes('already registered')) return 'email_taken';
  if (code.includes('weak_password')) return 'weak_password';
  if (code.includes('email_not_confirmed') || message.includes('not confirmed'))
    return 'email_not_confirmed';
  if (
    code.includes('invalid_credentials') ||
    code.includes('invalid_grant') ||
    message.includes('invalid login credentials')
  ) {
    return 'invalid_credentials';
  }

  return 'unexpected';
}
