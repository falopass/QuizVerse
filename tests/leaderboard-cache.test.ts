import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  getLeaderboard: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

vi.mock('@/lib/data/public', () => ({
  getLeaderboard: mocks.getLeaderboard,
}));

import { GET } from '@/app/api/leaderboard/route';

type DbResult = { data: unknown; error: unknown };

/** Builder thenable mínimo: cualquier método encadenado devuelve el mismo builder. */
function tableResult(result: DbResult) {
  const builder: Record<string, unknown> & { then: (resolve: (v: DbResult) => void) => void } = {
    then: (resolve) => resolve(result),
  };
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = () => builder;
  }
  return builder;
}

function request(scope: string): Request {
  return new Request(`https://quizverse.org/api/leaderboard?scope=${scope}`);
}

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.getLeaderboard.mockReset();
});

describe('GET /api/leaderboard — caché', () => {
  it('scope=friends responde con caché privada, nunca pública', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_follows') {
        return tableResult({ data: [{ following_id: 'u-2' }], error: null });
      }
      if (table === 'profiles') {
        return tableResult({
          data: [
            {
              id: 'u-1',
              username: 'ana',
              display_name: 'Ana',
              avatar_url: null,
              points: 100,
              quizzes_played: 5,
            },
          ],
          error: null,
        });
      }
      throw new Error(`tabla inesperada: ${table}`);
    });

    const response = await GET(request('friends'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await response.json();
    expect(body.scope).toBe('friends');
    expect(body.entries).toHaveLength(1);
  });

  it('scope=global sigue siendo cacheable en CDN', async () => {
    mocks.getLeaderboard.mockResolvedValue([
      {
        rank: 1,
        id: 'u-9',
        username: 'top',
        displayName: 'Top',
        avatarUrl: null,
        points: 999,
        quizzesPlayed: 42,
      },
    ]);

    const response = await GET(request('global'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('scope=friends sin sesión responde 401 sin cachear', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(request('friends'));

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
