import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as {
    id: string;
    email?: string;
    identities?: { provider: string }[];
  } | null,
  limitCheck: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } }),
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  authLimiter: { check: mocks.limitCheck },
}));

import { changePasswordAction, resetPasswordAction } from '@/actions/auth.actions';

const USER = { id: 'u1', email: 'u@x.com', identities: [{ provider: 'email' }] };

beforeEach(() => {
  mocks.user = USER;
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
});

describe('resetPasswordAction', () => {
  it('revoca las demás sesiones tras cambiar la clave', async () => {
    const result = await resetPasswordAction({ password: 'claveNueva1' });

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'claveNueva1' });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    );
    expect(result).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: true });
  });

  it('no revoca si updateUser falla', async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: 'weak_password' } });

    const result = await resetPasswordAction({ password: 'claveNueva1' });

    expect(result).toEqual({ ok: false, code: 'weak_password' });
    expect(mocks.signOut).not.toHaveBeenCalled();
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

  it('reporta revokedOtherSessions=false si el cierre falla (la clave ya cambió)', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'boom' } });

    const result = await changePasswordAction({
      password: 'claveNueva1',
      currentPassword: 'claveVieja1',
    });

    expect(result).toEqual({ ok: true, userId: 'u1', revokedOtherSessions: false });
  });
});
