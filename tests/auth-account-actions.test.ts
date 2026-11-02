import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  limitCheck: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  authLimiter: { check: mocks.limitCheck },
}));

import {
  forgotPasswordAction,
  signInAction,
  signOutAction,
  signUpAction,
} from '@/actions/auth.actions';

beforeEach(() => {
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.signUp.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  mocks.signInWithPassword
    .mockReset()
    .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
});

describe('signUpAction', () => {
  it('crea la cuenta pasando nombre y username normalizado al trigger', async () => {
    const result = await signUpAction({
      email: 'Nuevo@X.com ',
      password: 'claveSegura1',
      name: 'José María',
    });

    expect(result).toEqual({ ok: true, userId: 'u1' });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'nuevo@x.com',
      password: 'claveSegura1',
      options: {
        data: {
          name: 'José María',
          display_name: 'José María',
          username: 'jose_maria',
        },
      },
    });
  });

  it('deriva el displayName del email cuando no hay nombre', async () => {
    await signUpAction({ email: 'jugador.pro@x.com', password: 'claveSegura1' });

    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: expect.objectContaining({ name: 'jugador.pro', username: 'jugador_pro' }),
        },
      })
    );
  });

  it('usa el username explícito normalizado si viene', async () => {
    await signUpAction({
      email: 'a@x.com',
      password: 'claveSegura1',
      username: 'Mi User!',
    });

    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { data: expect.objectContaining({ username: 'mi_user' }) },
      })
    );
  });

  it('limita por hash del email, nunca por el email en claro', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await signUpAction({ email: 'a@x.com', password: 'claveSegura1' });

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    const key = mocks.limitCheck.mock.calls[0][0] as string;
    expect(key).toMatch(/^signup:[0-9a-f]{32}$/);
    expect(key).not.toContain('a@x.com');
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('mapea el error de email ya registrado', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    });

    const result = await signUpAction({ email: 'a@x.com', password: 'claveSegura1' });

    expect(result).toEqual({ ok: false, code: 'email_taken' });
  });

  it('rechaza entrada inválida sin tocar Supabase ni el limiter', async () => {
    const result = await signUpAction({ email: 'no-es-email', password: 'corta' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(mocks.limitCheck).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

describe('signInAction', () => {
  it('devuelve el userId al iniciar sesión', async () => {
    const result = await signInAction({ email: 'a@x.com', password: 'clave' });

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@x.com',
      password: 'clave',
    });
    expect(result).toEqual({ ok: true, userId: 'u1' });
  });

  it('mapea credenciales inválidas', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });

    const result = await signInAction({ email: 'a@x.com', password: 'mala' });

    expect(result).toEqual({ ok: false, code: 'invalid_credentials' });
  });

  it('mapea email no confirmado', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_not_confirmed' },
    });

    const result = await signInAction({ email: 'a@x.com', password: 'clave' });

    expect(result).toEqual({ ok: false, code: 'email_not_confirmed' });
  });

  it('corta en el rate limit sin llamar a Supabase', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await signInAction({ email: 'a@x.com', password: 'clave' });

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('rechaza entrada inválida', async () => {
    const result = await signInAction({ email: 'mal', password: '' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('signOutAction', () => {
  it('cierra la sesión y responde ok aunque el proveedor falle', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'boom' } });

    const result = await signOutAction();

    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(result).toEqual({ ok: true, userId: null });
  });
});

describe('forgotPasswordAction', () => {
  it('envía el correo con el callback del idioma pedido', async () => {
    const result = await forgotPasswordAction({ email: 'a@x.com', locale: 'es' });

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('a@x.com', {
      redirectTo: 'https://quizverse.org/callback?next=' + encodeURIComponent('/es/reset-password'),
    });
    expect(result).toEqual({ ok: true, userId: null });
  });

  it('cae a /en cuando el idioma no viene', async () => {
    await forgotPasswordAction({ email: 'a@x.com' });

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('a@x.com', {
      redirectTo: 'https://quizverse.org/callback?next=' + encodeURIComponent('/en/reset-password'),
    });
  });

  it('propaga el código del error del proveedor', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { code: 'unexpected_failure' } });

    const result = await forgotPasswordAction({ email: 'a@x.com', locale: 'en' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
  });

  it('corta en el rate limit', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await forgotPasswordAction({ email: 'a@x.com', locale: 'es' });

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('rechaza un email inválido', async () => {
    const result = await forgotPasswordAction({ email: 'nope', locale: 'es' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
