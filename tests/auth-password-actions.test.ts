import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  user: null as {
    id: string;
    email?: string;
    identities?: { provider: string }[];
  } | null,
  accessToken: null as string | null,
  cookieMap: new Map<string, string>(),
  cookieSets: [] as Array<{ name: string; value: string; options?: unknown }>,
  limitCheck: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  getRedis: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } }),
      getSession: async () => ({
        data: {
          session: mocks.accessToken ? { access_token: mocks.accessToken } : null,
        },
      }),
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  authLimiter: { check: mocks.limitCheck },
}));

vi.mock('@/lib/utils/redis', () => ({
  getRedis: mocks.getRedis,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookieMap.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    set: (name: string, value: string, options?: unknown) => {
      mocks.cookieSets.push({ name, value, options });
      if (value === '') mocks.cookieMap.delete(name);
      else mocks.cookieMap.set(name, value);
    },
  }),
}));

import { changePasswordAction, resetPasswordAction } from '@/actions/auth.actions';
import LocalizedResetPasswordPage from '@/app/[locale]/reset-password/page';
import {
  RECOVERY_COOKIE_NAME,
  beginRecoveryChallengeUse,
  createRecoveryChallenge,
  isRecoveryPath,
  isRecoverySession,
  recoverySigningAvailable,
  resetRecoveryMemoryStoreForTests,
  verifyRecoveryChallenge,
} from '@/lib/auth/password-recovery';

function makeFakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

const USER = { id: 'u1', email: 'u@x.com', identities: [{ provider: 'email' }] };
const RECOVERY_SECRET_ENV = 'PASSWORD_RECOVERY_SECRET';
const savedRecoverySecret = process.env[RECOVERY_SECRET_ENV];

beforeEach(() => {
  process.env[RECOVERY_SECRET_ENV] = 'test-recovery-secret-0123456789abcdef';
  resetRecoveryMemoryStoreForTests();
  mocks.user = USER;
  mocks.accessToken = makeFakeJwt({ session_id: 'sess-1', amr: [{ method: 'recovery' }] });
  mocks.cookieMap.clear();
  mocks.cookieSets.length = 0;
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.getRedis.mockReset().mockReturnValue(null);
});

afterAll(() => {
  if (savedRecoverySecret === undefined) delete process.env[RECOVERY_SECRET_ENV];
  else process.env[RECOVERY_SECRET_ENV] = savedRecoverySecret;
});

async function issueValidRecoveryCookie(userId = 'u1', sessionId: string | null = 'sess-1') {
  const issued = await createRecoveryChallenge({ userId, sessionId });
  expect(issued).not.toBeNull();
  mocks.cookieMap.set(RECOVERY_COOKIE_NAME, issued!.token);
  return issued!.token;
}

describe('resetPasswordAction', () => {
  it('rechaza una sesión ordinaria sin cookie de desafío de recuperación (A-06)', async () => {
    mocks.accessToken = makeFakeJwt({ session_id: 'sess-ordinary', amr: [{ method: 'password' }] });

    const result = await resetPasswordAction({ password: 'claveNueva1' });

    expect(result).toEqual({ ok: false, code: 'unauthorized' });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('acepta un desafío válido una sola vez, borra la cookie y revoca las demás sesiones', async () => {
    const token = await issueValidRecoveryCookie();

    const first = await resetPasswordAction({ password: 'claveNueva1' });

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'claveNueva1' });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    );
    expect(first).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: true });
    expect(mocks.cookieMap.has(RECOVERY_COOKIE_NAME)).toBe(false);

    // Reinyectar la misma cookie copiada falla por consumo de un solo uso.
    mocks.cookieMap.set(RECOVERY_COOKIE_NAME, token);
    const replay = await resetPasswordAction({ password: 'otraClave2' });
    expect(replay).toEqual({ ok: false, code: 'unauthorized' });
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });

  it('rechaza un desafío perteneciente a otro usuario o a otra sesión', async () => {
    await issueValidRecoveryCookie('otro-user', 'sess-1');
    expect(await resetPasswordAction({ password: 'claveNueva1' })).toEqual({
      ok: false,
      code: 'unauthorized',
    });

    await issueValidRecoveryCookie('u1', 'sess-distinta');
    expect(await resetPasswordAction({ password: 'claveNueva1' })).toEqual({
      ok: false,
      code: 'unauthorized',
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('no revoca ni quema el enlace si updateUser falla por weak_password', async () => {
    await issueValidRecoveryCookie();
    mocks.updateUser.mockResolvedValueOnce({ error: { code: 'weak_password' } });

    const first = await resetPasswordAction({ password: 'claveNueva1' });

    expect(first).toEqual({ ok: false, code: 'weak_password' });
    expect(mocks.signOut).not.toHaveBeenCalled();

    // El mismo desafío vigente permite reintentar con una clave fuerte.
    mocks.updateUser.mockResolvedValueOnce({ error: null });
    const retry = await resetPasswordAction({ password: 'ClaveFuerte!2026' });
    expect(retry).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: true });
  });

  it('reporta revokedOtherSessions=false si el cierre rechaza, sin propagar el error', async () => {
    await issueValidRecoveryCookie();
    mocks.signOut.mockRejectedValue(new Error('network down'));

    const result = await resetPasswordAction({ password: 'claveNueva1' });

    expect(result).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: false });
  });
});

describe('LocalizedResetPasswordPage (A-06)', () => {
  it('muestra el formulario solo cuando hay sesión + desafío de recuperación válido', async () => {
    await issueValidRecoveryCookie();

    const ui = await LocalizedResetPasswordPage({
      params: Promise.resolve({ locale: 'es' }),
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
  });

  it('bloquea el formulario para una sesión ordinaria y enlaza a /settings (ES y EN)', async () => {
    const uiEs = await LocalizedResetPasswordPage({
      params: Promise.resolve({ locale: 'es' }),
      searchParams: Promise.resolve({}),
    });
    const { unmount } = render(uiEs);

    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a ajustes de cuenta' })).toHaveAttribute(
      'href',
      '/es/settings'
    );
    unmount();

    const uiEn = await LocalizedResetPasswordPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    render(uiEn);

    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to account settings' })).toHaveAttribute(
      'href',
      '/en/settings'
    );
  });

  it('muestra salida localizada ES y EN para enlace vencido o sin sesión', async () => {
    mocks.user = null;

    const uiEs = await LocalizedResetPasswordPage({
      params: Promise.resolve({ locale: 'es' }),
      searchParams: Promise.resolve({ error: 'expired' }),
    });
    const { unmount } = render(uiEs);
    expect(screen.getByText(/El enlace ya no sirve/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/es/forgot-password'
    );
    unmount();

    const uiEn = await LocalizedResetPasswordPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ error: 'expired' }),
    });
    render(uiEn);
    expect(screen.getByText(/That link no longer works/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/en/forgot-password'
    );
  });
});

describe('changePasswordAction', () => {
  it('revalida la clave vigente y luego revoca las demás sesiones', async () => {
    const result = await changePasswordAction({
      password: 'claveNueva1',
      currentPassword: 'claveVieja1',
    });

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'u@x.com',
      password: 'claveVieja1',
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(result).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: true });
  });

  it('revoca también cuando la cuenta es solo OAuth (sin revalidación)', async () => {
    mocks.user = { id: 'u1', email: 'u@x.com', identities: [{ provider: 'google' }] };

    const result = await changePasswordAction({ password: 'claveNueva1' });

    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(result).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: true });
  });

  it('falla cerrado y exige currentPassword si identities falta o viene vacío', async () => {
    mocks.user = { id: 'u1', email: 'u@x.com' };

    const result = await changePasswordAction({ password: 'claveNueva1' });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_input',
      fieldErrors: { currentPassword: ['required'] },
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('reporta revokedOtherSessions=false si el cierre falla (la clave ya cambió)', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'boom' } });

    const result = await changePasswordAction({
      password: 'claveNueva1',
      currentPassword: 'claveVieja1',
    });

    expect(result).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: false });
  });
});

describe('password-recovery — firma, caducidad y consumo atómico', () => {
  it('detecta rutas de recuperación y sesiones con amr=recovery', () => {
    expect(isRecoveryPath('/es/reset-password')).toBe(true);
    expect(isRecoveryPath('/en/reset-password?error=expired')).toBe(true);
    expect(isRecoveryPath('/es/settings')).toBe(false);
    expect(isRecoveryPath('/fr/reset-password')).toBe(false);

    expect(
      isRecoverySession({
        access_token: makeFakeJwt({ amr: [{ method: 'recovery', timestamp: 1 }] }),
      })
    ).toBe(true);
    expect(
      isRecoverySession({
        access_token: makeFakeJwt({ amr: [{ method: 'oauth', provider: 'google' }] }),
      })
    ).toBe(false);
    expect(isRecoverySession({ access_token: 'not-a-jwt' })).toBe(false);
  });

  it('rechaza tokens caducados, alterados, malformados o sin secreto configurado', async () => {
    const now = 1_700_000_000_000;
    const issued = await createRecoveryChallenge({ userId: 'u1', sessionId: 's1' }, now);
    expect(issued).not.toBeNull();
    const token = issued!.token;

    // Caducado
    const expired = await verifyRecoveryChallenge(
      token,
      { userId: 'u1', sessionId: 's1' },
      now + 16 * 60 * 1000
    );
    expect(expired).toEqual({ ok: false, reason: 'expired' });

    // Firma alterada
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(await verifyRecoveryChallenge(tampered, { userId: 'u1', sessionId: 's1' }, now)).toEqual(
      { ok: false, reason: 'bad_signature' }
    );

    // Formato inválido
    expect(
      await verifyRecoveryChallenge('v2.abc.def', { userId: 'u1', sessionId: 's1' }, now)
    ).toEqual({ ok: false, reason: 'malformed' });

    // Sin secreto falla cerrado
    const prevRecovery = process.env.PASSWORD_RECOVERY_SECRET;
    const prevAttempt = process.env.QUIZ_ATTEMPT_SECRET;
    const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.PASSWORD_RECOVERY_SECRET;
    delete process.env.QUIZ_ATTEMPT_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect(recoverySigningAvailable()).toBe(false);
      expect(await createRecoveryChallenge({ userId: 'u1' }, now)).toBeNull();
      expect(await verifyRecoveryChallenge(token, { userId: 'u1', sessionId: 's1' }, now)).toEqual({
        ok: false,
        reason: 'unavailable',
      });
    } finally {
      if (prevRecovery !== undefined) process.env.PASSWORD_RECOVERY_SECRET = prevRecovery;
      if (prevAttempt !== undefined) process.env.QUIZ_ATTEMPT_SECRET = prevAttempt;
      if (prevService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
    }
  });

  it('coordina consumo de un solo uso con Redis ante concurrencia y replay', async () => {
    const store = new Map<string, unknown>();
    mocks.getRedis.mockReturnValue({
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown, opts?: { nx?: boolean }) => {
        if (opts?.nx && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
      del: async (key: string) => (store.delete(key) ? 1 : 0),
    });

    const issued = await createRecoveryChallenge({ userId: 'u1', sessionId: 's1' });
    const token = issued!.token;

    const firstClaim = await beginRecoveryChallengeUse(token, { userId: 'u1', sessionId: 's1' });
    expect(firstClaim.ok).toBe(true);
    if (!firstClaim.ok) return;

    // Segundo intento concurrente bloqueado mientras el primero está en vuelo.
    const concurrent = await beginRecoveryChallengeUse(token, { userId: 'u1', sessionId: 's1' });
    expect(concurrent).toEqual({ ok: false, reason: 'in_progress' });

    await firstClaim.complete();

    // Tras completar, incluso limpiando el mapa local de otro isolate, Redis bloquea el replay.
    resetRecoveryMemoryStoreForTests();
    expect(await verifyRecoveryChallenge(token, { userId: 'u1', sessionId: 's1' })).toEqual({
      ok: false,
      reason: 'consumed',
    });
    expect(await beginRecoveryChallengeUse(token, { userId: 'u1', sessionId: 's1' })).toEqual({
      ok: false,
      reason: 'consumed',
    });
  });
});
