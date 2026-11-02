import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  maybeSingle: vi.fn(),
  fromCalls: [] as { table: string; id: string }[],
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => {
          mocks.fromCalls.push({ table, id });
          return { maybeSingle: mocks.maybeSingle };
        },
      }),
    }),
  }),
}));

import { requireAdmin } from '@/lib/auth/require-admin';

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.fromCalls = [];
  mocks.maybeSingle.mockReset().mockResolvedValue({ data: { is_admin: true } });
});

describe('requireAdmin', () => {
  it('sin usuario responde no-admin sin consultar el perfil', async () => {
    mocks.user = null;

    const { user, isAdmin } = await requireAdmin();

    expect(user).toBeNull();
    expect(isAdmin).toBe(false);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it('un perfil con is_admin=false no es admin', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { is_admin: false } });

    const { user, isAdmin } = await requireAdmin();

    expect(user).toEqual({ id: 'u1' });
    expect(isAdmin).toBe(false);
    expect(mocks.fromCalls).toEqual([{ table: 'profiles', id: 'u1' }]);
  });

  it('un perfil sin fila (null) no es admin', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });

    const { isAdmin } = await requireAdmin();

    expect(isAdmin).toBe(false);
  });

  it('solo is_admin estrictamente true habilita el admin', async () => {
    const { user, isAdmin } = await requireAdmin();

    expect(user).toEqual({ id: 'u1' });
    expect(isAdmin).toBe(true);
  });
});
