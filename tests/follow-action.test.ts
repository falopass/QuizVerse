import { beforeEach, describe, expect, it, vi } from 'vitest';

const { insertSpy, deleteSpy, auth } = vi.hoisted(() => ({
  insertSpy: vi.fn(),
  deleteSpy: vi.fn(),
  auth: { userId: 'user-1' as string | null },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: auth.userId ? { id: auth.userId } : null } }),
    },
    from: (table: string) =>
      table === 'user_follows'
        ? {
            insert: (payload: unknown) => {
              insertSpy(payload);
              return Promise.resolve({ error: null });
            },
            delete: () => ({
              eq: () => ({
                eq: async () => {
                  deleteSpy();
                  return { error: null };
                },
              }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { username: 'objetivo' }, error: null }),
              }),
            }),
          },
  }),
}));

import { toggleFollowAction } from '@/actions/social.actions';

const TARGET = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

describe('toggleFollowAction', () => {
  beforeEach(() => {
    auth.userId = 'user-1';
    insertSpy.mockClear();
    deleteSpy.mockClear();
  });

  it('inserts into user_follows when follow=true', async () => {
    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: true });
    expect(insertSpy).toHaveBeenCalledWith({
      follower_id: 'user-1',
      following_id: TARGET,
    });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('deletes from user_follows when follow=false', async () => {
    const result = await toggleFollowAction(TARGET, false);

    expect(result).toEqual({ ok: true });
    expect(deleteSpy).toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('returns unauthorized without a session', async () => {
    auth.userId = null;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: false, code: 'unauthorized' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('returns unauthorized when the target is yourself', async () => {
    auth.userId = TARGET;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: false, code: 'unauthorized' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('returns invalid_input for a non-uuid target', async () => {
    const result = await toggleFollowAction('not-a-uuid', true);

    expect(result).toEqual({ ok: false, code: 'invalid_input' });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
