/**
 * Pruebas de alta y edición de perfil (hallazgo A-21):
 * - `updateProfileAction` actualiza directamente contra la restricción UNIQUE
 *   sin lectura previa TOCTOU y mapea `23505` a `username_taken`.
 * - La migración `029_proteger_alta_perfil.sql` nunca deriva username del
 *   prefijo del email y resuelve colisiones bajo `EXCEPTION WHEN unique_violation`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    user: { id: 'u1' } as { id: string } | null,
    updateError: null as { code?: string; message?: string } | null,
  };
  const ops: string[] = [];
  const updatePayloads: unknown[] = [];

  const limitCheck = vi.fn();

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: (table: string) => {
      ops.push(`from:${table}`);
      const chain = {
        select: () => {
          ops.push('select');
          return chain;
        },
        update: (payload: unknown) => {
          ops.push('update');
          updatePayloads.push(payload);
          return chain;
        },
        eq: (col: string, val: string) => {
          ops.push(`eq:${col}:${val}`);
          return chain;
        },
        then: (resolvePromise: (value: { error: unknown }) => unknown) =>
          Promise.resolve({ error: state.updateError }).then(resolvePromise),
      };
      return chain;
    },
  };

  return { state, ops, updatePayloads, limitCheck, supabase };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mocks.supabase,
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  apiLimiter: { check: mocks.limitCheck },
}));

import { updateProfileAction } from '@/actions/profile.actions';

beforeEach(() => {
  mocks.state.user = { id: 'u1' };
  mocks.state.updateError = null;
  mocks.ops.length = 0;
  mocks.updatePayloads.length = 0;
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
});

describe('updateProfileAction (A-21)', () => {
  it('actualiza el perfil directamente sin pre-lectura SELECT TOCTOU', async () => {
    const result = await updateProfileAction({
      displayName: 'Diego',
      username: 'Diego Pro!',
      bio: 'Hola',
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.ops).toEqual(['from:profiles', 'update', 'eq:id:u1']);
    expect(mocks.ops).not.toContain('select');
    expect(mocks.updatePayloads).toEqual([
      { display_name: 'Diego', username: 'diego_pro', bio: 'Hola' },
    ]);
  });

  it('mapea un conflicto concurrente UNIQUE (23505) de username a username_taken', async () => {
    mocks.state.updateError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "profiles_username_key"',
    };

    const result = await updateProfileAction({ username: 'campeon' });

    expect(result).toEqual({
      ok: false,
      code: 'username_taken',
      fieldErrors: { username: ['taken'] },
    });
  });

  it('mapea violación de CHECK (23514) en username a invalid_input', async () => {
    mocks.state.updateError = { code: '23514', message: 'username_format' };

    const result = await updateProfileAction({ username: 'valido' });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_input',
      fieldErrors: { username: ['username_format'] },
    });
  });

  it('rechaza sin sesión, con rate limit o con payload vacío', async () => {
    mocks.state.user = null;
    expect(await updateProfileAction({ displayName: 'A' })).toEqual({
      ok: false,
      code: 'unauthorized',
    });

    mocks.state.user = { id: 'u1' };
    mocks.limitCheck.mockResolvedValue({ allowed: false });
    expect(await updateProfileAction({ displayName: 'A' })).toEqual({
      ok: false,
      code: 'unexpected',
    });

    mocks.limitCheck.mockResolvedValue({ allowed: true });
    expect(await updateProfileAction({})).toEqual({ ok: false, code: 'empty' });
  });

  it('devuelve unexpected ante errores de DB ajenos a colisión de username', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.state.updateError = { code: '08006', message: 'connection failure' };

    const result = await updateProfileAction({ displayName: 'Diego' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    errorSpy.mockRestore();
  });
});

describe('migración 029_proteger_alta_perfil.sql', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/029_proteger_alta_perfil.sql'),
    'utf8'
  );

  // Extrae solo el cuerpo de la función PL/pgSQL para comprobar la lógica real.
  const body = sql.match(/AS \$\$([\s\S]*?)\$\$;/i)?.[1] ?? '';

  it('no usa NEW.email ni split_part para derivar el username público', () => {
    expect(body).not.toContain('NEW.email');
    expect(body).not.toContain('split_part');
    expect(body).toContain("'player_' || left(id_hex, 8)");
  });

  it('resuelve colisiones simultáneas bajo UNIQUE con EXCEPTION WHEN unique_violation y sin WHILE EXISTS', () => {
    expect(body).not.toMatch(/WHILE\s+EXISTS/i);
    expect(body).toContain('EXCEPTION');
    expect(body).toContain('WHEN unique_violation THEN');
    expect(body).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('usa full_name al resolver display_name para altas OAuth (Google/Facebook)', () => {
    expect(body).toContain("NEW.raw_user_meta_data->>'full_name'");
  });
});
