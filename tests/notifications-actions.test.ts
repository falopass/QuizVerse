import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  updateSpy: vi.fn(),
  eqSpy: vi.fn(),
  updateResult: { error: null as { message: string } | null },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
    from: (table: string) => {
      if (table !== 'notifications') throw new Error(`unexpected table ${table}`);
      return {
        update: (payload: unknown) => {
          mocks.updateSpy(payload);
          const chain = {
            eq: (column: string, value: unknown) => {
              mocks.eqSpy(column, value);
              return chain;
            },
            then: (resolve: (value: typeof mocks.updateResult) => void) =>
              resolve(mocks.updateResult),
          };
          return chain;
        },
      };
    },
  }),
}));

import { markAllNotificationsRead, markNotificationRead } from '@/actions/notifications.actions';

describe('markAllNotificationsRead', () => {
  beforeEach(() => {
    mocks.userId = 'user-1';
    mocks.updateSpy.mockClear();
    mocks.eqSpy.mockClear();
    mocks.updateResult = { error: null };
  });

  it('devuelve unauthorized sin sesión y no escribe', async () => {
    mocks.userId = null;

    const result = await markAllNotificationsRead();

    expect(result).toEqual({
      success: false,
      code: 'unauthorized',
      error: 'Sign in to read your notifications.',
    });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('marca is_read=true solo sobre las filas propias no leídas', async () => {
    const result = await markAllNotificationsRead();

    expect(result).toEqual({ success: true });
    expect(mocks.updateSpy).toHaveBeenCalledWith({ is_read: true });
    expect(mocks.eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.eqSpy).toHaveBeenCalledWith('is_read', false);
  });

  it('devuelve unexpected sin filtrar el mensaje de la base de datos', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.updateResult = { error: { message: 'boom' } };

    const result = await markAllNotificationsRead();

    expect(result).toEqual({
      success: false,
      code: 'unexpected',
      error: 'Something went wrong. Please try again.',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[action:notifications.markAllRead]',
      expect.objectContaining({ message: 'boom' })
    );
    errorSpy.mockRestore();
  });
});

describe('markNotificationRead', () => {
  const ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

  beforeEach(() => {
    mocks.userId = 'user-1';
    mocks.updateSpy.mockClear();
    mocks.eqSpy.mockClear();
    mocks.updateResult = { error: null };
  });

  it('rechaza un id inválido sin tocar la base de datos', async () => {
    const result = await markNotificationRead('no-es-uuid');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('devuelve unauthorized sin sesión', async () => {
    mocks.userId = null;

    const result = await markNotificationRead(ID);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('unauthorized');
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('marca is_read=true solo en esa notificación no leída', async () => {
    const result = await markNotificationRead(ID);

    expect(result).toEqual({ success: true });
    expect(mocks.updateSpy).toHaveBeenCalledWith({ is_read: true });
    expect(mocks.eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.eqSpy).toHaveBeenCalledWith('id', ID);
    expect(mocks.eqSpy).toHaveBeenCalledWith('is_read', false);
  });

  it('devuelve unexpected sin filtrar el mensaje de la base de datos', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.updateResult = { error: { message: 'boom' } };

    const result = await markNotificationRead(ID);

    expect(result).toEqual({
      success: false,
      code: 'unexpected',
      error: 'Something went wrong. Please try again.',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[action:notifications.markNotificationRead]',
      expect.objectContaining({ message: 'boom' })
    );
    errorSpy.mockRestore();
  });
});
