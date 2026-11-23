/**
 * Pruebas unitarias del módulo de dominio `account-deletion.ts` y contrato SQL
 * de la migración atómica `028_borrado_cuenta_atomico.sql` (hallazgos A-12 y D-14).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DELETE_ACCOUNT_CONTACT_EMAIL,
  DeleteAccountSchema,
  chunkIds,
  isMissingSchemaError,
  matchesOAuthConfirmation,
  requiresPasswordReauth,
} from '@/lib/auth/account-deletion';

describe('DeleteAccountSchema', () => {
  it('acepta contraseña vigente para cuentas con email', () => {
    expect(DeleteAccountSchema.safeParse({ password: 'claveActual1' }).success).toBe(true);
  });

  it('acepta frase de confirmación recortada para cuentas solo-OAuth', () => {
    const parsed = DeleteAccountSchema.safeParse({ confirmation: '  diego  ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.confirmation).toBe('diego');
  });

  it('rechaza contraseñas vacías o mayores al límite bcrypt (72)', () => {
    expect(DeleteAccountSchema.safeParse({ password: '' }).success).toBe(false);
    expect(DeleteAccountSchema.safeParse({ password: 'x'.repeat(73) }).success).toBe(false);
  });

  it('rechaza confirmaciones vacías o mayores a 254 caracteres', () => {
    expect(DeleteAccountSchema.safeParse({ confirmation: '   ' }).success).toBe(false);
    expect(DeleteAccountSchema.safeParse({ confirmation: 'a'.repeat(255) }).success).toBe(false);
  });

  it('expone el correo de soporte configurado', () => {
    expect(DELETE_ACCOUNT_CONTACT_EMAIL).toBe('hello@quizverse.org');
  });
});

describe('requiresPasswordReauth', () => {
  it('exige contraseña si el usuario tiene identidad email', () => {
    expect(requiresPasswordReauth({ identities: [{ provider: 'email' }] })).toBe(true);
    expect(
      requiresPasswordReauth({ identities: [{ provider: 'google' }, { provider: 'email' }] })
    ).toBe(true);
  });

  it('no exige contraseña solo cuando hay identidades OAuth y ninguna email', () => {
    expect(requiresPasswordReauth({ identities: [{ provider: 'google' }] })).toBe(false);
    expect(
      requiresPasswordReauth({ identities: [{ provider: 'facebook' }, { provider: 'github' }] })
    ).toBe(false);
  });

  it('falla cerrado (exige contraseña) si identities falta o viene vacío', () => {
    expect(requiresPasswordReauth({})).toBe(true);
    expect(requiresPasswordReauth({ identities: null })).toBe(true);
    expect(requiresPasswordReauth({ identities: [] })).toBe(true);
  });
});

describe('matchesOAuthConfirmation', () => {
  it('compara sin sensibilidad a mayúsculas ni espacios extremos', () => {
    expect(matchesOAuthConfirmation('  DIEGO ', 'diego')).toBe(true);
    expect(matchesOAuthConfirmation('User@Example.COM', 'user@example.com')).toBe(true);
  });

  it('rechaza valores vacíos o distintos', () => {
    expect(matchesOAuthConfirmation('', 'diego')).toBe(false);
    expect(matchesOAuthConfirmation('diego', '')).toBe(false);
    expect(matchesOAuthConfirmation('diego', null)).toBe(false);
    expect(matchesOAuthConfirmation('otro', 'diego')).toBe(false);
  });
});

describe('isMissingSchemaError y chunkIds', () => {
  it('reconoce códigos PostgREST y PostgreSQL de objetos ausentes', () => {
    for (const code of ['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883']) {
      expect(isMissingSchemaError({ code })).toBe(true);
    }
    expect(isMissingSchemaError({ code: '23505' })).toBe(false);
    expect(isMissingSchemaError(null)).toBe(false);
  });

  it('trocea listas respetando el tamaño del lote', () => {
    expect(chunkIds([], 200)).toEqual([]);
    expect(chunkIds(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });
});

describe('migración 028_borrado_cuenta_atomico.sql', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/028_borrado_cuenta_atomico.sql'),
    'utf8'
  );

  it('crea trigger BEFORE DELETE ON public.profiles para limpiar borradores y notificaciones', () => {
    expect(sql).toContain('BEFORE DELETE ON public.profiles');
    expect(sql).toContain('public.cleanup_profile_before_delete()');
    expect(sql).toMatch(/DELETE FROM public\.quizzes[\s\S]*status <> 'published'/);
    expect(sql).toContain('DELETE FROM public.notifications');
  });

  it('anonimiza referencias de moderación y es compatible sin 019 ni tablas opcionales', () => {
    expect(sql).toContain("to_regclass('public.quiz_reports')");
    expect(sql).toContain("to_regclass('public.comment_reports')");
    expect(sql).toContain("column_name = 'moderated_by'");
    expect(sql).toContain('ON DELETE SET NULL');
  });

  it('expone has_atomic_account_deletion solo para service_role', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.has_atomic_account_deletion()');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.has_atomic_account_deletion() FROM PUBLIC, anon, authenticated;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.has_atomic_account_deletion() TO service_role;'
    );
  });
});
