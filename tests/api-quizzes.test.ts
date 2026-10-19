/**
 * QUAL-29: contrato de GET /api/quizzes.
 *
 * Única ruta pública de catálogo: valida la query con `QuizQuerySchema`,
 * devuelve la página de `listPublishedQuizzes` tal cual y degrada a un
 * sobre de error coherente con el resto de las rutas de lectura.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPublishedQuizzes: vi.fn(),
}));

vi.mock('@/lib/data/catalog', () => ({
  listPublishedQuizzes: mocks.listPublishedQuizzes,
}));

import { GET } from '@/app/api/quizzes/route';

const URL = 'http://localhost/api/quizzes';

function makePage() {
  return {
    items: [
      {
        id: 'quiz-1',
        slug: 'capitanes-de-futbol',
        title: 'Capitanes de fútbol',
        description: 'Adivina el capitán',
        quizType: 'trivia',
        difficulty: 'medium',
        language: 'es',
        questionCount: 8,
        estimatedMinutes: 4,
        plays: 42,
        coverImageUrl: null,
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

  it('returns 200 with the { items, total, page, limit, hasMore } page as-is', async () => {
    const page = makePage();

    const res = await GET(new Request(URL));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(await res.json()).toEqual(page);
  });

  it('normalizes defaults: no params calls the data layer with page=1, limit=20', async () => {
    const res = await GET(new Request(URL));

    expect(res.status).toBe(200);
    expect(mocks.listPublishedQuizzes).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('passes normalized filters through to the data layer', async () => {
    const res = await GET(
      new Request(`${URL}?page=2&limit=10&locale=es&category=movies-tv&q=marvel`)
    );

    expect(res.status).toBe(200);
    expect(mocks.listPublishedQuizzes).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      locale: 'es',
      category: 'movies-tv',
      q: 'marvel',
    });
  });

  it.each(['page=0', 'limit=999', 'q=a'])('returns 400 invalid_query for ?%s', async (query) => {
    const res = await GET(new Request(`${URL}?${query}`));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_query');
    expect(body.details).toBeDefined();
    expect(mocks.listPublishedQuizzes).not.toHaveBeenCalled();
  });

  it('returns 503 catalog_unavailable when the data layer throws', async () => {
    mocks.listPublishedQuizzes.mockRejectedValue(new Error('db down'));

    const res = await GET(new Request(URL));

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'catalog_unavailable' });
  });
});
