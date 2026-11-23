/**
 * Borrado de cuenta: contrato y validación del formulario de /settings.
 *
 * El borrado es una operación destructiva, así que el servidor vuelve a pedir
 * una prueba de identidad antes de tocar `auth.users`:
 *
 * - Cuentas con identidad por email: la contraseña vigente.
 * - Cuentas solo-OAuth: escribir el username (o el email, si el perfil no se
 *   pudo leer) como confirmación explícita.
 *
 * Qué se borra y qué se anonimiza (lo aplica `deleteAccountAction`):
 *
 * - Se borran con la cuenta: perfil, comentarios, likes, follows, logros,
 *   notificaciones propias y quizzes no publicados (borradores privados).
 * - Se anonimizan: `game_sessions.player_id` → NULL (las partidas siguen
 *   contando para el quiz), reportes hechos o resueltos por la cuenta
 *   (`reporter_id`/`resolved_by` → NULL) y quizzes publicados
 *   (`creator_id` → NULL: el contenido queda, el autor desaparece).
 * - Se eliminan además las notificaciones de otros usuarios que mencionaban a
 *   la cuenta (`data.user_id` / `data.follower_id`).
 */

import { z } from 'zod';

/** Correo de contacto cuando el borrado automático no está disponible. */
export const DELETE_ACCOUNT_CONTACT_EMAIL = 'hello@quizverse.org';

export const DeleteAccountSchema = z.object({
  /** Contraseña vigente, solo para cuentas con identidad por email. */
  password: z.string().min(1).max(72).optional(),
  /** Username (o email) escrito a mano, solo para cuentas solo-OAuth. */
  confirmation: z.string().trim().min(1).max(254).optional(),
});

export type DeleteAccountErrorCode =
  | 'unauthorized'
  | 'invalid_input'
  | 'invalid_credentials'
  | 'confirmation_mismatch'
  | 'rate_limited'
  | 'unavailable'
  | 'unexpected';

export type DeleteAccountResult = { ok: true } | { ok: false; code: DeleteAccountErrorCode };

/**
 * Determina si la cuenta exige revalidar contraseña antes de acciones sensibles
 * (cambio de contraseña o borrado de cuenta).
 *
 * Falla cerrado: solo se considera solo-OAuth cuando `identities` viene poblado
 * y ninguna identidad es `email`. Si `identities` falta o está vacío, se exige
 * contraseña para evitar que un objeto parcial salte la reautenticación.
 */
export function requiresPasswordReauth(user: {
  identities?: ReadonlyArray<{ provider?: string | null }> | null;
}): boolean {
  const identities = user.identities;
  if (!identities || identities.length === 0) return true;
  return identities.some((identity) => identity.provider === 'email');
}

/** Comprueba la frase de confirmación de una cuenta solo-OAuth (sin sensibilidad a mayúsculas). */
export function matchesOAuthConfirmation(
  typed: string | undefined,
  expectedTarget: string | null | undefined
): boolean {
  const expected = (expectedTarget ?? '').trim().toLowerCase();
  const actual = (typed ?? '').trim().toLowerCase();
  return expected.length > 0 && actual === expected;
}

/**
 * Errores de PostgREST / PostgreSQL que indican tabla, columna o RPC todavía
 * no desplegado en la base (compatibilidad con migraciones pendientes).
 */
export function isMissingSchemaError(error: { code?: string } | null | undefined): boolean {
  const code = error?.code;
  return (
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    code === '42883'
  );
}

/** Trocea listas de IDs para respetar límites de longitud de URL en filtros `in`. */
export function chunkIds(ids: readonly string[], chunkSize = 200): string[][] {
  if (ids.length === 0) return [];
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}
