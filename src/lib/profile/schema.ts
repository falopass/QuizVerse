import { z } from 'zod';
import { USERNAME_PATTERN, USERNAME_MAX, normalizeUsername } from '@/lib/auth/identity';

/**
 * Campos editables del perfil.
 *
 * El username se normaliza con la misma función que el alta, para que editar no
 * pueda dejar un valor que el CHECK de la base rechace después.
 */
export const ProfileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(280).optional(),
  username: z
    .string()
    .trim()
    .transform((value) => normalizeUsername(value))
    .refine((value) => USERNAME_PATTERN.test(value), { message: 'username_format' })
    .optional(),
  preferredLanguage: z.enum(['en', 'es']).optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

/** Convierte el input ya validado en el `update` de Supabase. */
export function toProfileUpdate(input: ProfileUpdateInput): Record<string, string | null> {
  const update: Record<string, string | null> = {};
  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.bio !== undefined) update.bio = input.bio || null;
  if (input.username !== undefined) update.username = input.username.slice(0, USERNAME_MAX);
  if (input.preferredLanguage !== undefined) update.preferred_language = input.preferredLanguage;
  return update;
}

export type ProfileActionResult =
  | { ok: true }
  | {
      ok: false;
      code: 'unauthorized' | 'invalid_input' | 'username_taken' | 'empty' | 'unexpected';
      fieldErrors?: Record<string, string[] | undefined>;
    };
