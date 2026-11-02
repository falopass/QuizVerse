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
