/**
 * SEO-I18N-08, cableado de páginas: la ficha, /play y /result convierten el
 * 404 de un slug pedido bajo el locale equivocado en un 308 (permanentRedirect)
 * al destino que resuelve `getQuizLocaleRedirect`, conservando los tokens de
 * reto y resultado. El resolver en sí se prueba en quiz-locale-redirect.test.ts.
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getQuizLocaleRedirect: vi.fn(),
  getPublishedQuizzes: vi.fn(),
  getQuizSessionByShareToken: vi.fn(),
  getRelatedQuizzes: vi.fn(),
  getChallengeForQuiz: vi.fn(),
  getPersonalityChallengeForQuiz: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  getQuizLocaleRedirect: mocks.getQuizLocaleRedirect,
  getPublishedQuizzes: mocks.getPublishedQuizzes,
  getQuizSessionByShareToken: mocks.getQuizSessionByShareToken,
  getRelatedQuizzes: mocks.getRelatedQuizzes,
}));

vi.mock('@/lib/data/challenge', () => ({
  getChallengeForQuiz: mocks.getChallengeForQuiz,
  getPersonalityChallengeForQuiz: mocks.getPersonalityChallengeForQuiz,
}));

vi.mock('@/components/home/quiz-detail-page', () => ({
  QuizDetailPage: () => <div data-testid="detail" />,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import LocalizedQuizDetailPage from '@/app/[locale]/quiz/[slug]/page';
import LocalizedQuizPlayPage from '@/app/[locale]/quiz/[slug]/play/page';
import LocalizedQuizResultPage from '@/app/[locale]/quiz/[slug]/result/page';

const params = (locale: string, slug: string) => Promise.resolve({ locale, slug });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getQuizBySlug.mockResolvedValue(null);
});

describe('ficha · slug bajo el locale equivocado', () => {
  it('308 al par traducido cuando existe', async () => {
    mocks.getQuizLocaleRedirect.mockResolvedValue({
      locale: 'es',
      slug: 'es-trivia-fan-de-star-wars',
    });

    await expect(
      LocalizedQuizDetailPage({ params: params('es', 'en-star-wars-fan-trivia-challenge') })
    ).rejects.toThrow('NEXT_REDIRECT:/es/quiz/es-trivia-fan-de-star-wars');
  });

  it('308 al mismo slug en su idioma cuando no hay par', async () => {
    mocks.getQuizLocaleRedirect.mockResolvedValue({
      locale: 'en',
      slug: 'en-solo-english-trivia',
    });

    await expect(
      LocalizedQuizDetailPage({ params: params('es', 'en-solo-english-trivia') })
    ).rejects.toThrow('NEXT_REDIRECT:/en/quiz/en-solo-english-trivia');
  });

  it('404 cuando el slug no existe en ningún idioma', async () => {
    mocks.getQuizLocaleRedirect.mockResolvedValue(null);

    await expect(LocalizedQuizDetailPage({ params: params('es', 'no-existe') })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });

  it('no consulta el redirect si el quiz existe en el locale pedido', async () => {
    mocks.getQuizBySlug.mockResolvedValue({ slug: 'en-x', language: 'en' });

    const element = await LocalizedQuizDetailPage({ params: params('en', 'en-x') });

    expect(element).toBeTruthy();
    expect(mocks.getQuizLocaleRedirect).not.toHaveBeenCalled();
  });
});

describe('play y result · slug bajo el locale equivocado', () => {
  it('play conserva ?challenge en el 308 y no cambia de quiz', async () => {
    mocks.getQuizLocaleRedirect.mockResolvedValue({ locale: 'en', slug: 'en-x' });

    await expect(
      LocalizedQuizPlayPage({
        params: params('es', 'en-x'),
        searchParams: Promise.resolve({ challenge: 'abc123' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/en/quiz/en-x/play?challenge=abc123');
    expect(mocks.getQuizLocaleRedirect).toHaveBeenCalledWith('en-x', 'es', { keepSameQuiz: true });
  });

  it('play sin reto redirige sin query y puede ir al par traducido', async () => {
    mocks.getQuizLocaleRedirect.mockResolvedValue({ locale: 'en', slug: 'en-x' });

    await expect(
      LocalizedQuizPlayPage({
        params: params('es', 'en-x'),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/en/quiz/en-x/play');
    expect(mocks.getQuizLocaleRedirect).toHaveBeenCalledWith('en-x', 'es', { keepSameQuiz: false });
  });

  it('result conserva s y challenge en el 308 y no cambia de quiz', async () => {
    mocks.getQuizLocaleRedirect.mockResolvedValue({ locale: 'en', slug: 'en-x' });

    await expect(
      LocalizedQuizResultPage({
        params: params('es', 'en-x'),
        searchParams: Promise.resolve({ s: '0123456789abcdef', challenge: 'chal456' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/en/quiz/en-x/result?s=0123456789abcdef&challenge=chal456');
    expect(mocks.getQuizLocaleRedirect).toHaveBeenCalledWith('en-x', 'es', { keepSameQuiz: true });
  });
});
