import { describe, expect, it } from 'vitest';
import {
  PasswordResetRequestSchema,
  PasswordUpdateSchema,
  SignInSchema,
  SignUpSchema,
  isValidUsername,
  mapAuthError,
  normalizeUsername,
  withUsernameSuffix,
} from '@/lib/auth/identity';
import { authMessage } from '@/lib/auth/messages';

describe('normalizeUsername', () => {
  it('quita acentos y separa palabras', () => {
    expect(normalizeUsername('José Pérez')).toBe('jose_perez');
    expect(normalizeUsername('María-José')).toBe('maria_jose');
    expect(normalizeUsername('Ñandú Çedrés')).toBe('nandu_cedres');
  });

  it('descarta emoji, signos y puntos', () => {
    expect(normalizeUsername('Ana 🎮')).toBe('ana');
    expect(normalizeUsername('user.name+tag')).toBe('user_name_tag');
    expect(normalizeUsername('  ¿Qué?  ')).toBe('que');
  });

  it('colapsa separadores repetidos y los recorta de los extremos', () => {
    expect(normalizeUsername('a   b---c')).toBe('a_b_c');
    expect(normalizeUsername('__hola__')).toBe('hola');
  });

  it('respeta el mínimo de 3 y el máximo de 24', () => {
    expect(normalizeUsername('ab')).toBe('ab_');
    expect(normalizeUsername('a'.repeat(40))).toHaveLength(24);
  });

  it('cae en un valor válido cuando no queda nada', () => {
    expect(normalizeUsername('🎮🎮')).toBe('player');
    expect(normalizeUsername('')).toBe('player');
  });

  it('siempre produce algo que pasa el CHECK de la base', () => {
    const inputs = ['José Pérez', '🎮', 'a', 'x'.repeat(50), '  ', 'María-José Ñ'];
    for (const input of inputs) {
      expect(isValidUsername(normalizeUsername(input))).toBe(true);
    }
  });
});

describe('withUsernameSuffix', () => {
  it('es determinista para el mismo seed', () => {
    const seed = '550e8400-e29b-41d4-a716-446655440000';
    expect(withUsernameSuffix('jose', seed)).toBe(withUsernameSuffix('jose', seed));
  });

  it('añade un sufijo alfanumérico del seed', () => {
    expect(withUsernameSuffix('jose', '550e8400-e29b')).toBe('jose_550e');
  });

  it('nunca supera los 24 caracteres', () => {
    const long = 'a'.repeat(24);
    const result = withUsernameSuffix(long, 'abc123');
    expect(result.length).toBeLessThanOrEqual(24);
    expect(isValidUsername(result)).toBe(true);
  });

  it('devuelve la base si el seed no aporta caracteres', () => {
    expect(withUsernameSuffix('jose', '---')).toBe('jose');
  });
});

describe('esquemas de auth', () => {
  it('normaliza el email a minúsculas', () => {
    const parsed = SignUpSchema.parse({ email: '  Ana@Example.COM ', password: 'unaClaveLarga' });
    expect(parsed.email).toBe('ana@example.com');
  });

  it('rechaza email inválido y contraseña corta', () => {
    expect(SignUpSchema.safeParse({ email: 'no-es-email', password: '12345678' }).success).toBe(
      false
    );
    expect(SignUpSchema.safeParse({ email: 'a@b.co', password: 'corta' }).success).toBe(false);
    expect(SignUpSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) }).success).toBe(
      false
    );
  });

  it('acepta el alta mínima', () => {
    expect(SignUpSchema.safeParse({ email: 'a@b.co', password: '12345678' }).success).toBe(true);
  });

  it('el login no exige longitud mínima (la valida el proveedor)', () => {
    expect(SignInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(SignInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('esquemas de recuperación', () => {
  it('normaliza el email y deja el locale en en por defecto', () => {
    const parsed = PasswordResetRequestSchema.parse({ email: '  Ana@Example.COM ' });
    expect(parsed.email).toBe('ana@example.com');
    expect(parsed.locale).toBe('en');
  });

  it('acepta solo los locales del sitio', () => {
    expect(PasswordResetRequestSchema.safeParse({ email: 'a@b.co', locale: 'es' }).success).toBe(
      true
    );
    expect(PasswordResetRequestSchema.safeParse({ email: 'a@b.co', locale: 'fr' }).success).toBe(
      false
    );
  });

  it('la nueva contraseña exige 8 a 72 caracteres', () => {
    expect(PasswordUpdateSchema.safeParse({ password: 'corta' }).success).toBe(false);
    expect(PasswordUpdateSchema.safeParse({ password: 'x'.repeat(73) }).success).toBe(false);
    expect(PasswordUpdateSchema.safeParse({ password: '12345678' }).success).toBe(true);
  });

  it('la clave actual es opcional pero no vacía', () => {
    expect(PasswordUpdateSchema.safeParse({ password: '12345678' }).success).toBe(true);
    expect(
      PasswordUpdateSchema.safeParse({ password: '12345678', currentPassword: '' }).success
    ).toBe(false);
    expect(
      PasswordUpdateSchema.safeParse({ password: '12345678', currentPassword: 'vieja' }).success
    ).toBe(true);
  });
});

describe('mapAuthError', () => {
  it('traduce los códigos de Supabase a códigos del dominio', () => {
    expect(mapAuthError({ code: 'user_already_exists' })).toBe('email_taken');
    expect(mapAuthError({ code: 'weak_password' })).toBe('weak_password');
    expect(mapAuthError({ code: 'email_not_confirmed' })).toBe('email_not_confirmed');
    expect(mapAuthError({ code: 'invalid_credentials' })).toBe('invalid_credentials');
    expect(mapAuthError({ message: 'Invalid login credentials' })).toBe('invalid_credentials');
    expect(mapAuthError({ message: 'User already registered' })).toBe('email_taken');
    expect(mapAuthError({ code: 'boom' })).toBe('unexpected');
  });
});

describe('authMessage', () => {
  it('devuelve el texto del idioma pedido', () => {
    expect(authMessage('rate_limited', 'es')).toContain('Demasiados intentos');
    expect(authMessage('rate_limited', 'en')).toContain('Too many attempts');
  });

  it('cae en inglés para idiomas desconocidos', () => {
    expect(authMessage('unexpected', 'fr')).toContain('Something went wrong');
  });
});
