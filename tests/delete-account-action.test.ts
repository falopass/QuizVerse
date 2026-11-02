import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `deleteAccountAction` es la puerta del borrado de cuenta. Estos tests fijan:
 * sin sesión, contraseña incorrecta, sin service key, éxito (con el admin
 * client mockeado), cuentas solo-OAuth y qué pasa con los quizzes publicados.
 */

const mocks = vi.hoisted(() => {
  type Result = { data?: unknown; error?: unknown };
  type Entry = { table: string; ops: string[]; args: unknown[] };

  const state = {
    user: null as { id: string; email?: string; identities?: { provider: string }[] } | null,
    profile: null as { username: string } | null,
    drafts: [] as { id: string }[],
    reportsError: null as unknown,
    commentReportsError: null as unknown,
    serviceAvailable: true,
  };

  const serverChains: Entry[] = [];
  const serviceChains: Entry[] = [];

  function makeChain(table: string, chains: Entry[], result: Result) {
    const entry: Entry = { table, ops: [], args: [] };
    chains.push(entry);
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'in', 'or', 'update', 'delete', 'maybeSingle']) {
      chain[method] = (...args: unknown[]) => {
        entry.ops.push(method);
        entry.args.push(...args);
        return chain;
      };
    }
    chain.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  }

  const signInWithPassword = vi.fn();
  const signOut = vi.fn();
  const deleteUser = vi.fn();
  const limitCheck = vi.fn();

  const server = {
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      signInWithPassword,
      signOut,
    },
    from: (table: string) =>
      makeChain(
        table,
        serverChains,
        table === 'profiles' ? { data: state.profile, error: null } : { data: null, error: null }
      ),
  };

  const service = {
    auth: { admin: { deleteUser } },
    from: (table: string) =>
      makeChain(
        table,
        serviceChains,
        table === 'quizzes'
          ? { data: state.drafts, error: null }
          : table === 'quiz_reports'
            ? { data: null, error: state.reportsError }
            : table === 'comment_reports'
              ? { data: null, error: state.commentReportsError }
              : { data: null, error: null }
      ),
  };

  return {
    state,
    serverChains,
    serviceChains,
    server,
    service,
    signInWithPassword,
    signOut,
    deleteUser,
    limitCheck,
  };
});

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mocks.server }));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => (mocks.state.serviceAvailable ? mocks.service : null),
}));
vi.mock('@/lib/utils/rate-limit', () => ({ authLimiter: { check: mocks.limitCheck } }));

import { deleteAccountAction } from '@/actions/account.actions';

const EMAIL_USER = { id: 'u1', email: 'u@x.com', identities: [{ provider: 'email' }] };
const OAUTH_USER = { id: 'u1', email: 'u@x.com', identities: [{ provider: 'google' }] };

function serviceChain(table: string, op: string) {
  return mocks.serviceChains.find((entry) => entry.table === table && entry.ops.includes(op));
}

beforeEach(() => {
  mocks.state.user = EMAIL_USER;
  mocks.state.profile = { username: 'diego' };
  mocks.state.drafts = [{ id: 'draft-1' }];
  mocks.state.reportsError = null;
  mocks.state.commentReportsError = null;
  mocks.state.serviceAvailable = true;
  mocks.serverChains.length = 0;
  mocks.serviceChains.length = 0;
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.deleteUser.mockReset().mockResolvedValue({ error: null });
});

describe('deleteAccountAction', () => {
  it('sin sesión no toca nada y responde unauthorized', async () => {
    mocks.state.user = null;

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unauthorized' });
    expect(mocks.limitCheck).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('con contraseña incorrecta no borra la cuenta', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } });

    const result = await deleteAccountAction({ password: 'incorrecta' });

    expect(result).toEqual({ ok: false, code: 'invalid_credentials' });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'u@x.com',
      password: 'incorrecta',
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('sin SUPABASE_SERVICE_ROLE_KEY falla de forma tipada antes de revalidar', async () => {
    mocks.state.serviceAvailable = false;

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unavailable' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('corta por rate limit antes de revalidar', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'rate_limited' });
    expect(mocks.limitCheck).toHaveBeenCalledWith('delete-account:u1');
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('rechaza la entrada sin contraseña en cuentas con email', async () => {
    const result = await deleteAccountAction({});

    expect(result).toEqual({ ok: false, code: 'invalid_input' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('con la clave correcta borra auth.users, anonimiza reportes y limpia borradores', async () => {
    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: true });
    expect(mocks.deleteUser).toHaveBeenCalledWith('u1');
    expect(mocks.signOut).toHaveBeenCalled();

    const reports = serviceChain('quiz_reports', 'update');
    expect(reports?.args).toEqual([{ resolved_by: null }, 'resolved_by', 'u1']);

    const commentReports = serviceChain('comment_reports', 'update');
    expect(commentReports?.args).toEqual([{ resolved_by: null }, 'resolved_by', 'u1']);

    const notifications = serviceChain('notifications', 'delete');
    expect(notifications?.args).toEqual(['data->>user_id.eq.u1,data->>follower_id.eq.u1']);

    const draftsRead = serviceChain('quizzes', 'select');
    expect(draftsRead?.ops).toEqual(['select', 'eq', 'neq']);
    expect(draftsRead?.args).toEqual(['id', 'creator_id', 'u1', 'status', 'published']);

    // Solo se borran los no publicados: los publicados quedan con creator_id NULL.
    const draftsDelete = serviceChain('quizzes', 'delete');
    expect(draftsDelete?.ops).toEqual(['delete', 'in']);
    expect(draftsDelete?.args).toEqual(['id', ['draft-1']]);
  });

  it('no borra borradores si el admin delete falla: la cuenta sigue intacta', async () => {
    mocks.deleteUser.mockResolvedValue({ error: { message: 'boom' } });

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    expect(serviceChain('quizzes', 'delete')).toBeUndefined();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('si falla la anonimización de quiz_reports no intenta borrar la cuenta', async () => {
    mocks.state.reportsError = { message: 'fk' };

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('si comment_reports aún no está desplegada (PGRST205) sigue con el borrado', async () => {
    mocks.state.commentReportsError = {
      code: 'PGRST205',
      message: "Could not find the table 'public.comment_reports'",
    };

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: true });
    expect(mocks.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('una cuenta solo-OAuth confirma escribiendo el username', async () => {
    mocks.state.user = OAUTH_USER;

    const result = await deleteAccountAction({ confirmation: '  DIEGO ' });

    expect(result).toEqual({ ok: true });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('una cuenta solo-OAuth con la frase equivocada no borra', async () => {
    mocks.state.user = OAUTH_USER;

    const result = await deleteAccountAction({ confirmation: 'otro' });

    expect(result).toEqual({ ok: false, code: 'confirmation_mismatch' });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('si no hay perfil, la confirmación OAuth cae al email de la cuenta', async () => {
    mocks.state.user = OAUTH_USER;
    mocks.state.profile = null;

    const result = await deleteAccountAction({ confirmation: 'U@X.COM' });

    expect(result).toEqual({ ok: true });
    expect(mocks.deleteUser).toHaveBeenCalledWith('u1');
  });
});
