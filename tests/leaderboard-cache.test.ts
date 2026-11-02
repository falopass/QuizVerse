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
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'range']) {
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

  it('scope=global sigue siendo cacheable en CDN y responde plano', async () => {
    mocks.getLeaderboard.mockResolvedValue({
      entries: [
        {
          rank: 1,
          user: {
            id: 'u-9',
            username: 'top',
            display_name: 'Top',
            avatar_url: null,
            is_admin: true,
          },
          points: 999,
          quizzesPlayed: 42,
        },
      ],
      hasMore: false,
    });

    const response = await GET(request('global'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(mocks.from).not.toHaveBeenCalled();
    const body = await response.json();
    // Forma plana y sin columnas internas del perfil (SOC-06/SOC-09).
    expect(body.entries[0]).toEqual({
      rank: 1,
      id: 'u-9',
      username: 'top',
      displayName: 'Top',
      avatarUrl: null,
      points: 999,
      quizzesPlayed: 42,
    });
    expect(body.entries[0]).not.toHaveProperty('is_admin');
    expect(body).toMatchObject({ page: 1, limit: 20, hasMore: false });
  });

  it('scope=friends pagina con range y responde la misma forma plana', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === 'user_follows'
        ? tableResult({ data: [{ following_id: 'u-2' }], error: null })
        : tableResult({
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
          })
    );

    const response = await GET(
      new Request('https://quizverse.org/api/leaderboard?scope=friends&page=2&limit=5')
    );
    const body = await response.json();

    expect(body).toMatchObject({ scope: 'friends', page: 2, limit: 5, hasMore: false });
    expect(body.entries[0]).toEqual({
      rank: 6,
      id: 'u-1',
      username: 'ana',
      displayName: 'Ana',
      avatarUrl: null,
      points: 100,
      quizzesPlayed: 5,
    });
  });

  it('scope=friends sin sesión responde 401 sin cachear', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(request('friends'));

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
