import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  categoryHasQuizzes: vi.fn(),
  getEquivalentQuizSlug: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  categoryHasQuizzes: mocks.categoryHasQuizzes,
}));

vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: mocks.getEquivalentQuizSlug,
}));

import { GET } from '@/app/api/quiz/locale/route';

function request(query: string): Request {
  return new Request(`https://quizverse.org/api/quiz/locale?${query}`);
}

const sourceQuiz = {
  slug: 'en-solo-quiz',
  locale: 'en',
  category: { slug: 'movies-tv' },
};

beforeEach(() => {
  mocks.getQuizBySlug.mockReset();
  mocks.categoryHasQuizzes.mockReset();
  mocks.getEquivalentQuizSlug.mockReset();
});

describe('GET /api/quiz/locale — degradación sin pareja', () => {
  it('con pareja publicada responde la ficha traducida', async () => {
    mocks.getQuizBySlug
      .mockResolvedValueOnce(sourceQuiz)
      .mockResolvedValueOnce({ slug: 'es-quiz-pareja' });
    mocks.getEquivalentQuizSlug.mockReturnValue('es-quiz-pareja');

    const response = await GET(request('slug=en-solo-quiz&from=en&to=es'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: '/es/quiz/es-quiz-pareja' });
  });

  it('sin pareja pero con categoría poblada responde la categoría en el idioma destino', async () => {
    mocks.getQuizBySlug.mockResolvedValueOnce(sourceQuiz);
    mocks.getEquivalentQuizSlug.mockReturnValue(null);
    mocks.categoryHasQuizzes.mockResolvedValue(true);

    const response = await GET(request('slug=en-solo-quiz&from=en&to=es'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: '/es/category/movies-tv' });
    expect(mocks.categoryHasQuizzes).toHaveBeenCalledWith('movies-tv', 'es');
  });

  it('sin pareja y con categoría vacía en destino responde la home del idioma destino', async () => {
    mocks.getQuizBySlug.mockResolvedValueOnce(sourceQuiz);
    mocks.getEquivalentQuizSlug.mockReturnValue(null);
    mocks.categoryHasQuizzes.mockResolvedValue(false);

    const response = await GET(request('slug=en-solo-quiz&from=en&to=es'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: '/es' });
  });

  it('sin pareja ni categoría responde la home del idioma destino', async () => {
    mocks.getQuizBySlug.mockResolvedValueOnce({ ...sourceQuiz, category: null });
    mocks.getEquivalentQuizSlug.mockReturnValue(null);

    const response = await GET(request('slug=en-solo-quiz&from=en&to=es'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: '/es' });
  });

  it('con query inválida responde 400', async () => {
    const response = await GET(request('slug=en-solo-quiz&from=en&to=fr'));

    expect(response.status).toBe(400);
    expect(mocks.getQuizBySlug).not.toHaveBeenCalled();
  });

  it('con origen inexistente responde la home del idioma destino', async () => {
    mocks.getQuizBySlug.mockResolvedValueOnce(null);

    const response = await GET(request('slug=en-fantasma&from=en&to=es'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: '/es' });
    expect(mocks.getEquivalentQuizSlug).not.toHaveBeenCalled();
  });
});
