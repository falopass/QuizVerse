import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `deleteAccountAction` es la puerta del borrado de cuenta. Estos tests fijan:
 * sin sesión, contraseña incorrecta, sin service key, éxito (con el admin
 * client mockeado), cuentas solo-OAuth, qué pasa con los quizzes publicados y
 * que la autoría de los reportes se restaure si el borrado no ocurre.
 */

const mocks = vi.hoisted(() => {
  type Result = { data?: unknown; error?: unknown };
  type Entry = { table: string; ops: string[]; args: unknown[] };

  const state = {
    user: null as { id: string; email?: string; identities?: { provider: string }[] } | null,
    profile: null as { username: string } | null,
    drafts: [] as { id: string }[],
    resolvedQuizReports: [] as { id: string }[],
    resolvedCommentReports: [] as { id: string }[],
    reportsReadError: null as unknown,
    quizReportsUpdateError: null as unknown,
    commentReportsReadError: null as unknown,
    commentReportsUpdateError: null as unknown,
    serviceAvailable: true,
  };

  const serverChains: Entry[] = [];
  const serviceChains: Entry[] = [];

  function makeChain(table: string, chains: Entry[], resultFor: (ops: string[]) => Result) {
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
    chain.then = (resolve: (value: Result) => unknown) =>
      Promise.resolve(resultFor(entry.ops)).then(resolve);
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
      makeChain(table, serverChains, () =>
        table === 'profiles' ? { data: state.profile, error: null } : { data: null, error: null }
      ),
  };

  const service = {
    auth: { admin: { deleteUser } },
    from: (table: string) =>
      makeChain(table, serviceChains, (ops) => {
        if (table === 'quizzes') return { data: state.drafts, error: null };
        if (table === 'quiz_reports') {
          return ops.includes('select')
            ? { data: state.resolvedQuizReports, error: state.reportsReadError }
            : { data: null, error: state.quizReportsUpdateError };
        }
        if (table === 'comment_reports') {
          return ops.includes('select')
            ? { data: state.resolvedCommentReports, error: state.commentReportsReadError }
            : { data: null, error: state.commentReportsUpdateError };
        }
        return { data: null, error: null };
      }),
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

function serviceChainsFor(table: string, op: string) {
  return mocks.serviceChains.filter((entry) => entry.table === table && entry.ops.includes(op));
}

beforeEach(() => {
  mocks.state.user = EMAIL_USER;
  mocks.state.profile = { username: 'diego' };
  mocks.state.drafts = [{ id: 'draft-1' }];
  mocks.state.resolvedQuizReports = [{ id: 'report-1' }];
  mocks.state.resolvedCommentReports = [{ id: 'comment-report-1' }];
  mocks.state.reportsReadError = null;
  mocks.state.quizReportsUpdateError = null;
  mocks.state.commentReportsReadError = null;
  mocks.state.commentReportsUpdateError = null;
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

    const quizReports = serviceChainsFor('quiz_reports', 'update');
    expect(quizReports).toHaveLength(1);
    expect(quizReports[0].args).toEqual([{ resolved_by: null }, 'id', ['report-1']]);

    const commentReports = serviceChainsFor('comment_reports', 'update');
    expect(commentReports).toHaveLength(1);
    expect(commentReports[0].args).toEqual([{ resolved_by: null }, 'id', ['comment-report-1']]);

    const notifications = serviceChainsFor('notifications', 'delete');
    expect(notifications[0].args).toEqual(['data->>user_id.eq.u1,data->>follower_id.eq.u1']);

    const draftsRead = serviceChainsFor('quizzes', 'select');
    expect(draftsRead[0].ops).toEqual(['select', 'eq', 'neq']);
    expect(draftsRead[0].args).toEqual(['id', 'creator_id', 'u1', 'status', 'published']);

    // Solo se borran los no publicados: los publicados quedan con creator_id NULL.
    const draftsDelete = serviceChainsFor('quizzes', 'delete');
    expect(draftsDelete[0].ops).toEqual(['delete', 'in']);
    expect(draftsDelete[0].args).toEqual(['id', ['draft-1']]);
  });

  it('si el admin delete falla, restaura la autoría de los reportes y no borra borradores', async () => {
    mocks.deleteUser.mockResolvedValue({ error: { message: 'boom' } });

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    expect(serviceChainsFor('quizzes', 'delete')).toHaveLength(0);
    expect(mocks.signOut).not.toHaveBeenCalled();

    const quizReports = serviceChainsFor('quiz_reports', 'update');
    expect(quizReports.map((entry) => entry.args[0])).toEqual([
      { resolved_by: null },
      { resolved_by: 'u1' },
    ]);
    const commentReports = serviceChainsFor('comment_reports', 'update');
    expect(commentReports.map((entry) => entry.args[0])).toEqual([
      { resolved_by: null },
      { resolved_by: 'u1' },
    ]);
  });

  it('si falla la lectura de reportes resueltos no intenta borrar la cuenta', async () => {
    mocks.state.reportsReadError = { message: 'boom' };

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('si falla la anonimización de comment_reports, compensa quiz_reports', async () => {
    mocks.state.commentReportsUpdateError = { message: 'boom' };

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: false, code: 'unexpected' });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    const quizReports = serviceChainsFor('quiz_reports', 'update');
    expect(quizReports.map((entry) => entry.args[0])).toEqual([
      { resolved_by: null },
      { resolved_by: 'u1' },
    ]);
    const commentReports = serviceChainsFor('comment_reports', 'update');
    expect(commentReports.map((entry) => entry.args[0])).toEqual([{ resolved_by: null }]);
  });

  it('si comment_reports aún no está desplegada (PGRST205) sigue con el borrado', async () => {
    mocks.state.commentReportsReadError = {
      code: 'PGRST205',
      message: "Could not find the table 'public.comment_reports'",
    };

    const result = await deleteAccountAction({ password: 'claveVieja1' });

    expect(result).toEqual({ ok: true });
    expect(mocks.deleteUser).toHaveBeenCalledWith('u1');
    expect(serviceChainsFor('comment_reports', 'update')).toHaveLength(0);
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
