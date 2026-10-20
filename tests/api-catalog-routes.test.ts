/**
 * Contract tests for GET /api/quizzes and GET /api/categories.
 *
 * The two public catalog reads every external client (mobile, embed, future
 * integrations) depends on: they must keep their response envelope, reject
 * bad params with a 400, and degrade to a 503 envelope when the data layer
 * fails — never a bare 500.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPublishedQuizzes: vi.fn(),
  getPublicCategories: vi.fn(),
}));

vi.mock('@/lib/data/catalog', () => ({
  listPublishedQuizzes: mocks.listPublishedQuizzes,
}));

vi.mock('@/lib/data/public', () => ({
  getPublicCategories: mocks.getPublicCategories,
}));

import { GET as quizzesGET } from '@/app/api/quizzes/route';
import { GET as categoriesGET } from '@/app/api/categories/route';

const QUIZZES_URL = 'https://quizverse.org/api/quizzes';
const CATEGORIES_URL = 'https://quizverse.org/api/categories';

function makePage() {
  return {
    items: [
      {
        id: 'quiz-1',
        slug: 'capitanes-de-futbol',
        title: 'Capitanes de fútbol',
        description: 'Adivina el capitán',
        quiz_type: 'trivia',
        difficulty: 'medium',
        language: 'es',
        question_count: 8,
        estimated_minutes: 4,
        plays_count: 42,
        cover_image_url: 'https://example.com/cover.jpg',
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    hasMore: false,
  };
}

describe('GET /api/quizzes', () => {
  beforeEach(() => {
    mocks.listPublishedQuizzes.mockReset();
    mocks.listPublishedQuizzes.mockResolvedValue(makePage());
  });

  it('returns 200 with the { items, total, page, limit } envelope', async () => {
    const res = await quizzesGET(new Request(`${QUIZZES_URL}?page=1&limit=20`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(mocks.listPublishedQuizzes).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('passes filters through to the data layer', async () => {
    const res = await quizzesGET(new Request(`${QUIZZES_URL}?locale=es&category=gaming&q=zelda`));

    expect(res.status).toBe(200);
    expect(mocks.listPublishedQuizzes).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      locale: 'es',
      category: 'gaming',
      q: 'zelda',
    });
  });

  it.each(['limit=999', 'page=0'])('returns 400 invalid_query for ?%s', async (qs) => {
    const res = await quizzesGET(new Request(`${QUIZZES_URL}?${qs}`));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_query');
    expect(mocks.listPublishedQuizzes).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_query for an unsupported locale', async () => {
    const res = await quizzesGET(new Request(`${QUIZZES_URL}?locale=fr`));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_query');
    expect(mocks.listPublishedQuizzes).not.toHaveBeenCalled();
  });

  it('returns 503 catalog_unavailable when the data layer throws', async () => {
    mocks.listPublishedQuizzes.mockRejectedValue(new Error('db down'));

    const res = await quizzesGET(new Request(QUIZZES_URL));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'catalog_unavailable' });
  });
});

describe('GET /api/categories', () => {
  beforeEach(() => {
    mocks.getPublicCategories.mockReset();
    mocks.getPublicCategories.mockResolvedValue([
      { id: 'c1', slug: 'movies-tv', label_en: 'Movies & TV', label_es: 'Cine y TV', icon: 'film' },
      { id: 'c2', slug: 'gaming', label_en: 'Gaming', label_es: 'Videojuegos', icon: 'gamepad' },
    ]);
  });

  it('returns 200 with { categories, total }', async () => {
    const res = await categoriesGET(new Request(CATEGORIES_URL));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.categories).toHaveLength(2);
  });

  it('returns 400 invalid_locale for an unsupported locale', async () => {
    const res = await categoriesGET(new Request(`${CATEGORIES_URL}?locale=fr`));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_locale');
    expect(mocks.getPublicCategories).not.toHaveBeenCalled();
  });

  it('returns 503 catalog_unavailable when the data layer throws', async () => {
    mocks.getPublicCategories.mockRejectedValue(new Error('db down'));

    const res = await categoriesGET(new Request(CATEGORIES_URL));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'catalog_unavailable' });
  });
});
