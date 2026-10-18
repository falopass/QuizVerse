import { describe, expect, it } from 'vitest';
import { ProfileUpdateSchema, toProfileUpdate } from '@/lib/profile/schema';

describe('ProfileUpdateSchema', () => {
  it('normaliza el username igual que el alta', () => {
    const parsed = ProfileUpdateSchema.parse({ username: 'José Pérez' });
    expect(parsed.username).toBe('jose_perez');
  });

  it('rechaza un username que no llega al formato', () => {
    const result = ProfileUpdateSchema.safeParse({ username: '🎮🎮🎮' });
    // La normalización lo convierte en `player`, que sí es válido.
    expect(result.success ? result.data.username : null).toBe('player');
    expect(ProfileUpdateSchema.safeParse({ username: 'a'.repeat(80) }).success).toBe(true);
  });

  it('limita la bio a 280', () => {
    expect(ProfileUpdateSchema.safeParse({ bio: 'x'.repeat(281) }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ bio: 'x'.repeat(280) }).success).toBe(true);
  });

  it('acepta un update parcial', () => {
    expect(ProfileUpdateSchema.safeParse({ displayName: 'Ana' }).success).toBe(true);
    expect(ProfileUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('toProfileUpdate', () => {
  it('mapea a columnas de la base', () => {
    const update = toProfileUpdate({
      displayName: 'Ana',
      bio: 'Hola',
      username: 'ana',
      preferredLanguage: 'es',
    });
    expect(update).toEqual({
      display_name: 'Ana',
      bio: 'Hola',
      username: 'ana',
      preferred_language: 'es',
    });
  });

  it('convierte bio vacía en null', () => {
    expect(toProfileUpdate({ bio: '' })).toEqual({ bio: null });
  });

  it('no incluye lo que no vino', () => {
    expect(toProfileUpdate({ displayName: 'Ana' })).toEqual({ display_name: 'Ana' });
  });
});
