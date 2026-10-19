import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, updateSpy, eqSpy, supabaseStub } = vi.hoisted(() => {
  const updateSpy = vi.fn();
  const eqSpy = vi.fn();
  const supabaseStub = {
    from: () => ({
      update: (payload: unknown) => {
        updateSpy(payload);
        return {
          eq: (column: string, value: unknown) => {
            eqSpy(column, value);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    }),
  };
  const state = { user: null as { id: string } | null, isAdmin: false };
  return { state, updateSpy, eqSpy, supabaseStub };
});

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: async () => ({
    supabase: supabaseStub,
    user: state.user,
    isAdmin: state.isAdmin,
  }),
}));

import { resolveQuizReport } from '@/actions/moderation.actions';

const REPORT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('resolveQuizReport', () => {
  beforeEach(() => {
    state.user = null;
    state.isAdmin = false;
    updateSpy.mockClear();
    eqSpy.mockClear();
  });

  it('rejects a non-uuid report id before touching auth', async () => {
    const result = await resolveQuizReport('not-a-uuid');
    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns unauthorized when there is no session', async () => {
    const result = await resolveQuizReport(REPORT_ID);
    expect(result).toMatchObject({ success: false, code: 'unauthorized' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns forbidden for a signed-in non-admin', async () => {
    state.user = { id: 'user-1' };
    state.isAdmin = false;

    const result = await resolveQuizReport(REPORT_ID);
    expect(result).toMatchObject({ success: false, code: 'forbidden' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('marks the report resolved by the admin', async () => {
    state.user = { id: 'admin-1' };
    state.isAdmin = true;

    const result = await resolveQuizReport(REPORT_ID);
    expect(result).toEqual({ success: true });

    const payload = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.resolved).toBe(true);
    expect(payload.resolved_by).toBe('admin-1');
    expect(typeof payload.resolved_at).toBe('string');
    expect(eqSpy).toHaveBeenCalledWith('id', REPORT_ID);
  });
});
