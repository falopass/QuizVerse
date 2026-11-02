import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  limitCheck: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInWithOAuth: mocks.signInWithOAuth },
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  authLimiter: { check: mocks.limitCheck },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.7' }),
}));

import { signInWithOAuthAction } from '@/actions/auth.actions';

beforeEach(() => {
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.signInWithOAuth.mockReset().mockResolvedValue({
    data: { url: 'https://provider.example/auth?code_challenge=abc' },
    error: null,
  });
});

describe('signInWithOAuthAction', () => {
  it('rechaza un proveedor fuera de la lista', async () => {
    const result = await signInWithOAuthAction({ provider: 'myspace', next: '/en' });

    expect(result).toEqual({ ok: false, code: 'invalid_input' });
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('limita los intentos por IP del cliente', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await signInWithOAuthAction({ provider: 'google' });

    expect(mocks.limitCheck).toHaveBeenCalledWith('oauth:203.0.113.7');
    expect(result).toEqual({ ok: false, code: 'rate_limited' });
  });

  it('devuelve la URL del proveedor con el callback y el next saneado', async () => {
    const result = await signInWithOAuthAction({ provider: 'facebook', next: '/es/create' });

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'facebook',
      options: {
        redirectTo: 'https://quizverse.org/callback?next=%2Fes%2Fcreate',
      },
    });
    expect(result).toEqual({
      ok: true,
      url: 'https://provider.example/auth?code_challenge=abc',
    });
  });

  it('bloquea el open redirect en `next` y cae al fallback', async () => {
    await signInWithOAuthAction({ provider: 'google', next: 'https://evil.example' });

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://quizverse.org/callback?next=%2Fen' },
    });
  });

  it('falla limpio cuando GoTrue no devuelve URL', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: 'off' } });

    const result = await signInWithOAuthAction({ provider: 'github' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
  });
});
