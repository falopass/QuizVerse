import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  limitCheck: vi.fn(),
  ipLimitCheck: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signUp: mocks.signUp,
      resend: mocks.resend,
      signInWithPassword: mocks.signInWithPassword,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  authLimiter: { check: mocks.limitCheck },
  authIpLimiter: { check: mocks.ipLimitCheck },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.7' }),
}));

import {
  forgotPasswordAction,
  resendConfirmationAction,
  signInAction,
  signUpAction,
} from '@/actions/auth.actions';

const SIGNUP = { email: 'nueva@example.com', password: 'claveNueva1', name: 'Nueva', locale: 'es' };

beforeEach(() => {
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.ipLimitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.signUp.mockReset().mockResolvedValue({
    data: { user: { id: 'u1' }, session: null },
    error: null,
  });
  mocks.resend.mockReset().mockResolvedValue({ data: {}, error: null });
  mocks.signInWithPassword.mockReset().mockResolvedValue({
    data: { user: { id: 'u1' } },
    error: null,
  });
  mocks.resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
});

describe('signUpAction con confirmación por email', () => {
  it('marca needsEmailConfirmation cuando no hay sesión y fija emailRedirectTo', async () => {
    const result = await signUpAction(SIGNUP);

    expect(result).toEqual({ ok: true, userId: 'u1', needsEmailConfirmation: true });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'nueva@example.com',
      password: 'claveNueva1',
      options: {
        emailRedirectTo: 'https://quizverse.org/callback?next=%2Fes',
        data: { name: 'Nueva', display_name: 'Nueva', username: 'nueva' },
      },
    });
  });

  it('no marca needsEmailConfirmation cuando Supabase devuelve sesión', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
      error: null,
    });

    const result = await signUpAction({ ...SIGNUP, locale: 'en' });

    expect(result).toEqual({ ok: true, userId: 'u1', needsEmailConfirmation: false });
    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://quizverse.org/callback?next=%2Fen',
        }),
      })
    );
  });

  it('limita el alta por IP además de por email', async () => {
    mocks.ipLimitCheck.mockResolvedValue({ allowed: false });

    const result = await signUpAction(SIGNUP);

    expect(mocks.ipLimitCheck).toHaveBeenCalledWith('signup:203.0.113.7');
    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

describe('resendConfirmationAction', () => {
  it('reenvía el correo de confirmación con el callback del idioma', async () => {
    const result = await resendConfirmationAction({ email: 'nueva@example.com', locale: 'es' });

    expect(mocks.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'nueva@example.com',
      options: { emailRedirectTo: 'https://quizverse.org/callback?next=%2Fes' },
    });
    expect(result).toEqual({ ok: true, userId: null });
  });

  it('bloquea por límite de email sin llamar a Supabase', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await resendConfirmationAction({ email: 'nueva@example.com' });

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it('bloquea por límite de IP sin llamar a Supabase', async () => {
    mocks.ipLimitCheck.mockResolvedValue({ allowed: false });

    const result = await resendConfirmationAction({ email: 'nueva@example.com' });

    expect(mocks.ipLimitCheck).toHaveBeenCalledWith('resend:203.0.113.7');
    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it('rechaza input inválido sin tocar los limiters', async () => {
    const result = await resendConfirmationAction({ email: 'no-es-email' });

    expect(result.ok).toBe(false);
    expect(mocks.ipLimitCheck).not.toHaveBeenCalled();
    expect(mocks.limitCheck).not.toHaveBeenCalled();
  });
});

describe('límite por IP en las demás acciones de auth (AB-11)', () => {
  it('signInAction limita por IP antes de llamar a Supabase', async () => {
    mocks.ipLimitCheck.mockResolvedValue({ allowed: false });

    const result = await signInAction({ email: 'a@b.com', password: 'x'.repeat(9) });

    expect(mocks.ipLimitCheck).toHaveBeenCalledWith('signin:203.0.113.7');
    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signInAction mantiene el límite por email', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await signInAction({ email: 'a@b.com', password: 'x'.repeat(9) });

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('forgotPasswordAction limita por IP además de por email', async () => {
    mocks.ipLimitCheck.mockResolvedValue({ allowed: false });

    const result = await forgotPasswordAction({ email: 'a@b.com', locale: 'es' });

    expect(mocks.ipLimitCheck).toHaveBeenCalledWith('forgot:203.0.113.7');
    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
