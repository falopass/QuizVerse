/**
 * Contract tests for GET /api/stats and GET /api/categories.
 *
 * These are the two public read endpoints any catalog client consumes:
 * they must keep their response shape, validate `locale`, and degrade
 * to a 503 envelope when the data layer fails.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCatalogStats: vi.fn(),
  getPublicCategories: vi.fn(),
}));

vi.mock('@/lib/data/catalog', () => ({
  getCatalogStats: mocks.getCatalogStats,
}));

vi.mock('@/lib/data/public', () => ({
  getPublicCategories: mocks.getPublicCategories,
}));

import { GET as statsGET } from '@/app/api/stats/route';
import { GET as categoriesGET } from '@/app/api/categories/route';

const CATEGORIES_URL = 'http://localhost/api/categories';

function makeCategories() {
  return [
    { id: 'c1', slug: 'movies-tv', label_en: 'Movies & TV', label_es: 'Cine y TV', icon: 'film' },
    { id: 'c2', slug: 'gaming', label_en: 'Gaming', label_es: 'Videojuegos', icon: 'gamepad' },
  ];
}

function makeStats() {
  return {
    quizzes_published: 524,
    questions: 4192,
    by_locale: { en: 262, es: 262 },
    by_type: { trivia: 246, personality: 278 },
    categories: 16,
    games_played: 0,
  };
}

describe('GET /api/stats', () => {
  beforeEach(() => {
    mocks.getCatalogStats.mockReset();
  });

  it('returns 200 with the getCatalogStats payload as-is', async () => {
    const stats = makeStats();
    mocks.getCatalogStats.mockResolvedValue(stats);

    const res = await statsGET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual(stats);
  });

  it('returns 503 stats_unavailable when the data layer throws', async () => {
    mocks.getCatalogStats.mockRejectedValue(new Error('db down'));

    const res = await statsGET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'stats_unavailable' });
  });
});

describe('GET /api/categories', () => {
  beforeEach(() => {
    mocks.getPublicCategories.mockReset();
    mocks.getPublicCategories.mockResolvedValue(makeCategories());
  });

  it('returns 200 with { categories, total } where total equals categories.length', async () => {
    const res = await categoriesGET(new Request(CATEGORIES_URL));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.total).toBe(body.categories.length);
    expect(body.categories).toEqual(makeCategories());
  });

  it('returns 400 invalid_locale for an unsupported locale', async () => {
    const res = await categoriesGET(new Request(`${CATEGORIES_URL}?locale=fr`));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_locale');
    expect(mocks.getPublicCategories).not.toHaveBeenCalled();
  });

  it('treats an empty locale param as absent and returns 200', async () => {
    // `?locale=` parses to '' which the route treats as "no locale".
    const res = await categoriesGET(new Request(`${CATEGORIES_URL}?locale=`));

    expect(res.status).toBe(200);
    expect(mocks.getPublicCategories).toHaveBeenCalled();
  });

  it.each(['en', 'es'])('returns 200 for ?locale=%s', async (locale) => {
    const res = await categoriesGET(new Request(`${CATEGORIES_URL}?locale=${locale}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(body.categories.length);
  });

  it('returns 503 catalog_unavailable when the data layer throws', async () => {
    mocks.getPublicCategories.mockRejectedValue(new Error('db down'));

    const res = await categoriesGET(new Request(CATEGORIES_URL));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'catalog_unavailable' });
  });
});
