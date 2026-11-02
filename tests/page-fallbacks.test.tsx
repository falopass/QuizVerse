/**
 * F13: home y /quiz degradan al catálogo de lanzamiento cuando el payload de
 * datos falla entero (p. ej. Supabase caído), igual que la ficha de quiz, en
 * vez de propagar el error a la página de error.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Category, Quiz } from '@/types/quiz';

const mocks = vi.hoisted(() => ({
  getHomePayload: vi.fn(),
  getExplorePayload: vi.fn(),
  lastExploreProps: null as { quizzes: Quiz[]; categories: Category[] } | null,
}));

vi.mock('@/lib/data/public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/public')>();
  return {
    ...actual,
    getHomePayload: mocks.getHomePayload,
    getExplorePayload: mocks.getExplorePayload,
  };
});

vi.mock('@/lib/data/category-counts', () => ({
  getCategoryCounts: vi.fn(async () => new Map<string, number>()),
}));

// CategoryStrip es un server component async: suspende en el render síncrono
// del test y no aporta nada a las aserciones del fallback.
vi.mock('@/components/home/category-strip', () => ({
  CategoryStrip: () => null,
}));

vi.mock('@/components/home/explore-editorial-page', () => ({
  ExploreEditorialPage: (props: { quizzes: Quiz[]; categories: Category[] }) => {
    mocks.lastExploreProps = props;
    return <div data-testid="explore-editorial" />;
  },
}));

import LocalizedHomePage from '@/app/[locale]/page';
import LocalizedQuizExplorerPage from '@/app/[locale]/quiz/page';
import { getLaunchExplorePayload, getLaunchHomePayload } from '@/lib/data/public';

describe('fallback de página al catálogo de lanzamiento (F13)', () => {
  it('la home renderiza quizzes de lanzamiento cuando getHomePayload rechaza', async () => {
    mocks.getHomePayload.mockRejectedValue(new Error('supabase down'));

    const { container } = render(
      await LocalizedHomePage({ params: Promise.resolve({ locale: 'es' }) })
    );

    // El catálogo de lanzamiento se sirve completo: hero + grid de tarjetas.
    expect(
      container.querySelector('a[href="/es/quiz/puedes-acertar-estas-capitales-del-mundo-es"]')
    ).not.toBeNull();
    expect(container.querySelectorAll('.arcade-card').length).toBeGreaterThan(0);
  });

  it('la home usa el payload real cuando no falla', async () => {
    mocks.getHomePayload.mockResolvedValue({
      categories: [],
      trending: [],
      featured: [],
      quickPlays: [],
      freshlyPublished: [],
      totalQuizzes: 0,
      totalPlays: 0,
    });

    render(await LocalizedHomePage({ params: Promise.resolve({ locale: 'es' }) }));

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/Que energia de ciudad/)).not.toBeInTheDocument();
  });

  it('/quiz entrega los quizzes de lanzamiento recortados cuando getExplorePayload rechaza', async () => {
    mocks.getExplorePayload.mockRejectedValue(new Error('supabase down'));

    render(await LocalizedQuizExplorerPage({ params: Promise.resolve({ locale: 'es' }) }));

    const { quizzes, categories } = mocks.lastExploreProps!;
    expect(quizzes.length).toBeGreaterThan(0);
    expect(quizzes.every((quiz) => quiz.id.startsWith('launch-es-'))).toBe(true);
    expect(categories.length).toBeGreaterThan(0);

    // Aunque el fallback trae preguntas con clave, la página las recorta
    // antes de entregarlas al componente cliente.
    const json = JSON.stringify(mocks.lastExploreProps);
    expect(json).not.toContain('is_correct');
    expect(json).not.toContain('correct_answers');
  });
});

describe('payloads de lanzamiento', () => {
  it('getLaunchHomePayload tiene la misma forma que getHomePayload', () => {
    const payload = getLaunchHomePayload('es');

    expect(payload.trending.length).toBeGreaterThan(0);
    expect(payload.featured.every((quiz) => quiz.is_featured)).toBe(true);
    expect(payload.quickPlays.length).toBeGreaterThan(0);
    expect(payload.freshlyPublished.length).toBeGreaterThan(0);
    expect(payload.totalQuizzes).toBeGreaterThan(0);
    expect(payload.totalPlays).toBeGreaterThan(0);
    expect(
      [...payload.trending, ...payload.featured, ...payload.quickPlays].every(
        (quiz) => quiz.language === 'es'
      )
    ).toBe(true);
  });

  it('getLaunchExplorePayload filtra por locale y solo categorías pobladas', () => {
    const payload = getLaunchExplorePayload('en');

    expect(payload.quizzes.every((quiz) => quiz.language === 'en')).toBe(true);
    const populated = new Set(payload.quizzes.map((quiz) => quiz.category?.slug));
    expect(payload.categories.every((cat) => populated.has(cat.slug))).toBe(true);
  });
});
