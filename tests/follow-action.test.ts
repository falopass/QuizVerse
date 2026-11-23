import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ssrInsertSpy,
  ssrDeleteSpy,
  serviceInsertSpy,
  serviceDeleteSpy,
  auth,
  limit,
  serviceState,
} = vi.hoisted(() => ({
  ssrInsertSpy: vi.fn(),
  ssrDeleteSpy: vi.fn(),
  serviceInsertSpy: vi.fn(),
  serviceDeleteSpy: vi.fn(),
  auth: { userId: 'user-1' as string | null },
  limit: { allowed: true, errored: false },
  serviceState: {
    enabled: true,
    insertError: null as { code?: string; message?: string } | null,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/utils/rate-limit', () => ({
  socialLimiter: {
    check: async () => ({
      allowed: limit.allowed,
      remaining: limit.allowed ? 19 : 0,
      reset: 60,
      ...(limit.errored ? { errored: true } : {}),
    }),
  },
}));

function followsStub(insertSpy: typeof serviceInsertSpy, deleteSpy: typeof serviceDeleteSpy) {
  return {
    insert: (payload: unknown) => {
      insertSpy(payload);
      return Promise.resolve({ error: serviceState.insertError });
    },
    delete: () => ({
      eq: () => ({
        eq: async () => {
          deleteSpy();
          return { error: null };
        },
      }),
    }),
  };
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () =>
    serviceState.enabled
      ? {
          from: (table: string) => {
            if (table !== 'user_follows') throw new Error(`unexpected service table ${table}`);
            return followsStub(serviceInsertSpy, serviceDeleteSpy);
          },
        }
      : null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: auth.userId ? { id: auth.userId } : null } }),
    },
    from: (table: string) =>
      table === 'user_follows'
        ? followsStub(ssrInsertSpy, ssrDeleteSpy)
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
    limit.allowed = true;
    limit.errored = false;
    serviceState.enabled = true;
    serviceState.insertError = null;
    ssrInsertSpy.mockClear();
    ssrDeleteSpy.mockClear();
    serviceInsertSpy.mockClear();
    serviceDeleteSpy.mockClear();
  });

  it('inserts into user_follows via validated service writer when follow=true', async () => {
    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: true });
    expect(serviceInsertSpy).toHaveBeenCalledWith({
      follower_id: 'user-1',
      following_id: TARGET,
    });
    expect(ssrInsertSpy).not.toHaveBeenCalled();
    expect(serviceDeleteSpy).not.toHaveBeenCalled();
  });

  it('deletes from user_follows via validated service writer when follow=false', async () => {
    const result = await toggleFollowAction(TARGET, false);

    expect(result).toEqual({ ok: true });
    expect(serviceDeleteSpy).toHaveBeenCalled();
    expect(serviceInsertSpy).not.toHaveBeenCalled();
  });

  it('falls back to SSR client when service role key is unavailable', async () => {
    serviceState.enabled = false;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: true });
    expect(ssrInsertSpy).toHaveBeenCalledOnce();
    expect(serviceInsertSpy).not.toHaveBeenCalled();
  });

  it('treats duplicate follow (23505) as idempotent success', async () => {
    serviceState.insertError = { code: '23505', message: 'duplicate' };

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: true });
  });

  it('returns unauthorized without a session', async () => {
    auth.userId = null;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: false, code: 'unauthorized' });
    expect(serviceInsertSpy).not.toHaveBeenCalled();
  });

  it('returns unauthorized when the target is yourself', async () => {
    auth.userId = TARGET;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: false, code: 'unauthorized' });
    expect(serviceInsertSpy).not.toHaveBeenCalled();
  });

  it('returns invalid_input for a non-uuid target', async () => {
    const result = await toggleFollowAction('not-a-uuid', true);

    expect(result).toEqual({ ok: false, code: 'invalid_input' });
    expect(serviceInsertSpy).not.toHaveBeenCalled();
  });

  it('returns rate_limited (no unexpected) when the social limiter blocks (SOC-10)', async () => {
    limit.allowed = false;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(serviceInsertSpy).not.toHaveBeenCalled();
  });

  it('returns unexpected (not rate_limited) when the limiter backend is unavailable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    limit.allowed = false;
    limit.errored = true;

    const result = await toggleFollowAction(TARGET, true);

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    expect(serviceInsertSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
