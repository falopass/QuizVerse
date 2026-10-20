import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type DbResult = {
  data: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type Handler = (table: string, select: string, filters: string[]) => DbResult;

const db = vi.hoisted(() => ({
  calls: [] as string[],
  handler: ((_table: string, _select: string, _filters: string[]) => ({
    data: [],
    error: null,
  })) as Handler,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const filters: string[] = [];
      let selectCols = '*';
      const resolve = (): DbResult => {
        db.calls.push(`${table}(${selectCols})${filters.length ? ` ${filters.join(' ')}` : ''}`);
        return db.handler(table, selectCols, filters);
      };
      const query = {
        select: (cols?: string) => {
          selectCols = cols ?? '*';
          return query;
        },
        eq: (col: string, val: string) => {
          filters.push(`eq:${col}=${val}`);
          return query;
        },
        neq: (col: string, val: string) => {
          filters.push(`neq:${col}=${val}`);
          return query;
        },
        order: () => query,
        range: () => query,
        limit: () => query,
        single: async () => {
          const res = resolve();
          const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
          return { data: res.error ? null : data, error: res.error ?? null };
        },
        then: (
          onFulfilled?: null | ((value: DbResult) => unknown),
          onRejected?: null | ((reason: unknown) => unknown)
        ) => {
          const pending = new Promise<DbResult>((res, rej) => {
            try {
              res(resolve());
            } catch (error) {
              rej(error);
            }
          });
          return pending.then(onFulfilled ?? undefined, onRejected ?? undefined);
        },
      };
      return query;
    },
  }),
}));

vi.mock('@/lib/data/launch-catalog', () => ({
  LAUNCH_CATEGORIES: [{ id: 'cat-launch', slug: 'culture', name: 'Culture' }],
  LAUNCH_QUIZZES: [
    {
      id: 'launch-1',
      slug: 'launch-a',
      title: 'Launch A',
      language: 'en',
      plays_count: 10,
      category: { id: 'cat-launch', slug: 'culture' },
    },
    {
      id: 'launch-2',
      slug: 'launch-b',
      title: 'Launch B',
      language: 'en',
      plays_count: 5,
      category: { id: 'cat-launch', slug: 'culture' },
    },
    {
      id: 'launch-3',
      slug: 'launch-c',
      title: 'Launch C',
      language: 'es',
      plays_count: 7,
      category: { id: 'cat-launch', slug: 'culture' },
    },
  ],
}));

vi.mock('@/lib/data/normalizers', () => ({
  normalizeCategory: (row: unknown) => row,
  normalizeProfile: (row: unknown) => row,
  normalizeAchievement: (row: unknown) => row,
  normalizeQuiz: (row: Record<string, unknown>, categories: Map<string, unknown>) => ({
    ...row,
    category: categories.get(row.category_id as string) ?? null,
  }),
}));

import {
  categoryHasQuizzes,
  getHomePayload,
  getProfileByUsername,
  getPublicCategories,
  getPublishedQuizzes,
  getQuizBySlug,
  getQuizzesByCreatorId,
  getUnlockedAchievements,
} from '@/lib/data/public';

const catRow = { id: 'cat-1', slug: 'culture', name: 'Culture' };

function quizRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    slug: 'quiz-one',
    title: 'Quiz One',
    language: 'en',
    category_id: 'cat-1',
    status: 'published',
    quiz_type: 'trivia',
    questions: [],
    results: null,
    tags: [],
    plays_count: 0,
    estimated_minutes: 5,
    is_featured: false,
    created_at: '2026-01-01T00:00:00Z',
    published_at: null,
    ...overrides,
  };
}

function homeRows() {
  return Array.from({ length: 8 }, (_, i) =>
    quizRow({
      id: `q-${i}`,
      slug: `quiz-${i}`,
      plays_count: 100 - i * 10,
      estimated_minutes: 8 - i,
      is_featured: i < 5,
      created_at: `2026-01-0${i + 1}T00:00:00Z`,
    })
  );
}

beforeEach(() => {
  db.calls = [];
  db.handler = () => ({ data: [], error: null });
});

describe('getQuizBySlug', () => {
  it('returns the normalized quiz with its category when the row exists', async () => {
    db.handler = (table) =>
      table === 'quizzes'
        ? { data: [quizRow({ slug: 'quiz-one' })], error: null }
        : { data: [catRow], error: null };

    const quiz = await getQuizBySlug('quiz-one', 'en');
    expect(quiz?.slug).toBe('quiz-one');
    expect(quiz?.category).toEqual(catRow);
    expect(db.calls).toContain('quizzes(*) eq:slug=quiz-one eq:status=published eq:language=en');
    expect(db.calls).toContain('categories(*) eq:id=cat-1');
  });

  it('returns null when no row matches', async () => {
    db.handler = () => ({ data: [], error: null });
    expect(await getQuizBySlug('missing', 'en')).toBeNull();
  });

  it('falls back to the static catalog when the query throws', async () => {
    db.handler = () => {
      throw new Error('db down');
    };
    const quiz = await getQuizBySlug('launch-a', 'en');
    expect(quiz?.id).toBe('launch-1');
  });

  it('returns null from the fallback when the slug is unknown', async () => {
    db.handler = () => {
      throw new Error('db down');
    };
    expect(await getQuizBySlug('nope', 'en')).toBeNull();
  });
});

describe('getPublishedQuizzes', () => {
  it('filters published status and passes the locale', async () => {
    db.handler = (table) =>
      table === 'quizzes'
        ? { data: [quizRow(), quizRow({ id: 'q-2', slug: 'quiz-two' })], error: null }
        : { data: [catRow], error: null };

    const quizzes = await getPublishedQuizzes(10, 'es');
    expect(quizzes).toHaveLength(2);
    expect(db.calls).toContain('quizzes(*) eq:status=published eq:language=es');
  });

  it('returns an empty list when the db has no rows', async () => {
    db.handler = () => ({ data: [], error: null });
    expect(await getPublishedQuizzes(10, 'en')).toEqual([]);
  });

  it('falls back to the launch catalog filtered by locale on error', async () => {
    db.handler = () => ({ data: null, error: { message: 'boom' } });
    const quizzes = await getPublishedQuizzes(10, 'es');
    expect(quizzes.map((quiz) => quiz.slug)).toEqual(['launch-c']);
  });
});

describe('getHomePayload', () => {
  it('slices sections and reads totals from the db', async () => {
    db.handler = (table, select) => {
      if (table === 'categories') return { data: [catRow], error: null };
      if (select === 'plays_count') {
        return { data: [{ plays_count: 30 }, { plays_count: 20 }], error: null, count: 42 };
      }
      return { data: homeRows(), error: null };
    };

    const payload = await getHomePayload('en');
    expect(payload.trending).toHaveLength(6);
    expect(payload.trending.map((quiz) => quiz.plays_count)).toEqual([100, 90, 80, 70, 60, 50]);
    expect(payload.featured.length).toBeLessThanOrEqual(4);
    expect(payload.featured.every((quiz) => quiz.is_featured)).toBe(true);
    expect(payload.quickPlays.map((quiz) => quiz.estimated_minutes)).toEqual([1, 2, 3, 4]);
    expect(payload.freshlyPublished).toHaveLength(6);
    expect(payload.freshlyPublished[0].created_at).toBe('2026-01-08T00:00:00Z');
    expect(payload.totalQuizzes).toBe(42);
    expect(payload.totalPlays).toBe(50);
  });

  it('computes totals from the launch catalog when the totals query fails', async () => {
    db.handler = (table, select) => {
      if (table === 'categories') return { data: [catRow], error: null };
      if (select === 'plays_count') return { data: null, error: { message: 'boom' } };
      return { data: homeRows(), error: null };
    };

    const payload = await getHomePayload('en');
    expect(payload.totalQuizzes).toBe(2);
    expect(payload.totalPlays).toBe(15);
  });
});

describe('getPublicCategories', () => {
  it('returns normalized categories', async () => {
    db.handler = () => ({ data: [catRow], error: null });
    expect(await getPublicCategories()).toEqual([catRow]);
  });

  it('falls back to launch categories on error', async () => {
    db.handler = () => ({ data: null, error: { message: 'boom' } });
    expect(await getPublicCategories()).toEqual([
      { id: 'cat-launch', slug: 'culture', name: 'Culture' },
    ]);
  });
});

describe('categoryHasQuizzes', () => {
  it('checks a real category by category_id', async () => {
    db.handler = (table) =>
      table === 'quizzes' ? { data: [quizRow()], error: null } : { data: [catRow], error: null };

    expect(await categoryHasQuizzes('culture', 'es')).toBe(true);
    expect(db.calls).toContain(
      'quizzes(id) eq:status=published eq:category_id=cat-1 eq:language=es'
    );
  });

  it('checks type hubs by quiz_type (they have no categories row)', async () => {
    db.handler = () => ({ data: [quizRow()], error: null });

    expect(await categoryHasQuizzes('personality', 'en')).toBe(true);
    expect(db.calls).toContain(
      'quizzes(id) eq:status=published eq:quiz_type=personality eq:language=en'
    );
  });

  it('returns false when a type hub has no published quiz in the locale', async () => {
    db.handler = () => ({ data: [], error: null });
    expect(await categoryHasQuizzes('trivia', 'es')).toBe(false);
  });

  it('returns false for unknown slugs without querying quizzes', async () => {
    db.handler = () => ({ data: [], error: null });
    expect(await categoryHasQuizzes('nope', 'en')).toBe(false);
    expect(db.calls.filter((call) => call.startsWith('quizzes'))).toEqual([]);
  });
});

describe('getProfileByUsername', () => {
  const profile = { id: 'u-1', username: 'diego', display_name: 'Diego' };

  it('returns the normalized profile', async () => {
    db.handler = () => ({ data: [profile], error: null });
    expect(await getProfileByUsername('diego')).toEqual(profile);
    expect(db.calls).toContain('profiles(*) eq:username=diego');
  });

  it('returns null when the profile does not exist', async () => {
    db.handler = () => ({ data: [], error: null });
    expect(await getProfileByUsername('ghost')).toBeNull();
  });

  it('returns null when the query errors', async () => {
    db.handler = () => ({ data: null, error: { message: 'boom' } });
    expect(await getProfileByUsername('diego')).toBeNull();
  });
});

describe('getQuizzesByCreatorId', () => {
  it('returns the creator quizzes with categories', async () => {
    db.handler = (table) =>
      table === 'quizzes'
        ? { data: [quizRow({ creator_id: 'u-1' })], error: null }
        : { data: [catRow], error: null };

    const quizzes = await getQuizzesByCreatorId('u-1');
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].category).toEqual(catRow);
    expect(db.calls).toContain('quizzes(*) eq:creator_id=u-1 eq:status=published');
  });

  it('returns [] when the quiz query errors', async () => {
    db.handler = (table) =>
      table === 'quizzes'
        ? { data: null, error: { message: 'boom' } }
        : { data: [catRow], error: null };
    expect(await getQuizzesByCreatorId('u-1')).toEqual([]);
  });

  it('returns [] when the categories query errors', async () => {
    db.handler = (table) =>
      table === 'quizzes'
        ? { data: [quizRow()], error: null }
        : { data: null, error: { message: 'boom' } };
    expect(await getQuizzesByCreatorId('u-1')).toEqual([]);
  });
});

describe('getUnlockedAchievements', () => {
  it('normalizes rows and drops entries without achievement', async () => {
    db.handler = () => ({
      data: [
        { achievement: { id: 'a-1', name: 'First quiz' } },
        { achievement: null },
        { achievement: { id: 'a-2', name: 'Ten plays' } },
      ],
      error: null,
    });

    const achievements = await getUnlockedAchievements('u-1');
    expect(achievements.map((item) => item.id)).toEqual(['a-1', 'a-2']);
    expect(db.calls).toContain('user_achievements(achievement:achievements(*)) eq:user_id=u-1');
  });

  it('returns [] when the query errors', async () => {
    db.handler = () => ({ data: null, error: { message: 'boom' } });
    expect(await getUnlockedAchievements('u-1')).toEqual([]);
  });

  it('returns [] when the query throws', async () => {
    db.handler = () => {
      throw new Error('db down');
    };
    expect(await getUnlockedAchievements('u-1')).toEqual([]);
  });
});
