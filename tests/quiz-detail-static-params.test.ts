import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublishedQuizzes: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getPublishedQuizzes: mocks.getPublishedQuizzes,
  getQuizBySlug: vi.fn(),
  getRelatedQuizzes: vi.fn(),
}));

import { generateStaticParams } from '@/app/[locale]/quiz/[slug]/page';

const QUIZZES_BY_LOCALE = {
  en: [{ slug: 'en-quiz-one' }, { slug: 'en-quiz-two' }],
  es: [{ slug: 'es-quiz-uno' }, { slug: 'es-quiz-dos' }],
} as const;

beforeEach(() => {
  mocks.getPublishedQuizzes.mockReset();
  mocks.getPublishedQuizzes.mockImplementation(
    async (_limit: number, locale: keyof typeof QUIZZES_BY_LOCALE) => [...QUIZZES_BY_LOCALE[locale]]
  );
});

describe('generateStaticParams — ficha de quiz por idioma', () => {
  it('pide los 80 más jugados de cada idioma, sin mezclar', async () => {
    await generateStaticParams();

    expect(mocks.getPublishedQuizzes).toHaveBeenCalledTimes(2);
    expect(mocks.getPublishedQuizzes).toHaveBeenCalledWith(80, 'en');
    expect(mocks.getPublishedQuizzes).toHaveBeenCalledWith(80, 'es');
  });

  it('devuelve un par {locale, slug} por quiz con el slug de su propio idioma', async () => {
    const params = await generateStaticParams();

    expect(params).toHaveLength(4);
    for (const param of params) {
      const expected = QUIZZES_BY_LOCALE[param.locale].map((quiz) => quiz.slug);
      expect(expected).toContain(param.slug);
    }
  });

  it('no genera duplicados ni pares cruzados entre idiomas', async () => {
    const params = await generateStaticParams();

    const keys = params.map((param) => `${param.locale}:${param.slug}`);
    expect(new Set(keys).size).toBe(params.length);

    expect(params.filter((param) => param.locale === 'en').map((param) => param.slug)).toEqual([
      'en-quiz-one',
      'en-quiz-two',
    ]);
    expect(params.filter((param) => param.locale === 'es').map((param) => param.slug)).toEqual([
      'es-quiz-uno',
      'es-quiz-dos',
    ]);
  });
});
