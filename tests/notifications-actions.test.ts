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
          return {
            eq: (column: string, value: unknown) => {
              mocks.eqSpy(column, value);
              return Promise.resolve(mocks.updateResult);
            },
          };
        },
      };
    },
  }),
}));

import { markAllNotificationsRead } from '@/actions/notifications.actions';

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

  it('marca is_read=true solo sobre las filas no leídas', async () => {
    const result = await markAllNotificationsRead();

    expect(result).toEqual({ success: true });
    expect(mocks.updateSpy).toHaveBeenCalledWith({ is_read: true });
    expect(mocks.eqSpy).toHaveBeenCalledWith('is_read', false);
  });

  it('devuelve unexpected si la base de datos falla', async () => {
    mocks.updateResult = { error: { message: 'boom' } };

    const result = await markAllNotificationsRead();

    expect(result).toEqual({ success: false, code: 'unexpected', error: 'boom' });
  });
});
