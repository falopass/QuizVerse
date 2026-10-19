import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const dbMocks = vi.hoisted(() => ({
  filters: [] as string[],
  limit: 0,
  createClientCalls: 0,
  quizzes: [] as Array<{ id: string; slug: string; category_id: string }>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    dbMocks.createClientCalls += 1;
    return {
      from: (table: string) =>
        table === 'categories'
          ? {
              select: () => ({
                order: async () => ({
                  data: [{ id: 'cat-science', slug: 'science', name: 'Science' }],
                  error: null,
                }),
              }),
            }
          : {
              select: () => {
                const query = {
                  eq: (column: string, value: string) => {
                    dbMocks.filters.push(`eq:${column}=${value}`);
                    return query;
                  },
                  neq: (column: string, value: string) => {
                    dbMocks.filters.push(`neq:${column}=${value}`);
                    return query;
                  },
                  order: () => query,
                  limit: async (n: number) => {
                    dbMocks.limit = n;
                    return { data: dbMocks.quizzes, error: null };
                  },
                };
                return query;
              },
            },
    };
  },
}));

vi.mock('@/lib/data/normalizers', () => ({
  normalizeCategory: (row: unknown) => row,
  normalizeQuiz: (row: Record<string, unknown>, categories: Map<string, unknown>) => ({
    ...row,
    category: categories.get(row.category_id as string) ?? null,
  }),
}));

import { ResultScreen } from '@/components/quiz/result-screen';
import { getRelatedQuizzes } from '@/lib/data/public';
import type { Quiz } from '@/types/quiz';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'space-trivia',
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the most moons?',
        options: [
          { id: 'q1a', text: 'Saturn' },
          { id: 'q1b', text: 'Mars' },
        ],
      },
    ],
    results: null,
    tags: ['space'],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: '2026-05-21T00:00:00.000Z',
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function relatedQuizzes(count: number): Quiz[] {
  return Array.from({ length: count }, (_, index) =>
    makeQuiz({
      id: `related-${index}`,
      slug: `related-quiz-${index}`,
      title: `Related Quiz ${index}`,
      language: 'es',
    })
  );
}

function renderResult(props: { locale?: 'en' | 'es'; related?: Quiz[] } = {}) {
  return render(
    <ResultScreen
      locale={props.locale ?? 'es'}
      quiz={makeQuiz()}
      result={null}
      answers={[]}
      related={props.related}
    />
  );
}

describe('ResultScreen · quizzes relacionados', () => {
  it('muestra «Sigue jugando» con 3 tarjetas en español', () => {
    renderResult({ related: relatedQuizzes(3) });

    const section = screen.getByRole('region', { name: 'Sigue jugando' });
    expect(within(section).getAllByRole('link')).toHaveLength(3);
    expect(within(section).getByRole('heading', { name: 'Related Quiz 0' })).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: 'Related Quiz 2' })).toBeInTheDocument();
  });

  it('usa el titular en inglés', () => {
    renderResult({ locale: 'en', related: relatedQuizzes(1) });

    expect(screen.getByRole('region', { name: 'Keep playing' })).toBeInTheDocument();
  });

  it('aparece aunque solo haya un relacionado', () => {
    renderResult({ related: relatedQuizzes(1) });

    const section = screen.getByRole('region', { name: 'Sigue jugando' });
    expect(within(section).getAllByRole('link')).toHaveLength(1);
  });

  it('recorta a 3 aunque lleguen más', () => {
    renderResult({ related: relatedQuizzes(4) });

    const section = screen.getByRole('region', { name: 'Sigue jugando' });
    expect(within(section).getAllByRole('link')).toHaveLength(3);
    expect(
      within(section).queryByRole('heading', { name: 'Related Quiz 3' })
    ).not.toBeInTheDocument();
  });

  it('no pinta la sección sin la prop o con la lista vacía', () => {
    const { unmount } = renderResult();
    expect(screen.queryByRole('region', { name: 'Sigue jugando' })).not.toBeInTheDocument();
    unmount();

    renderResult({ related: [] });
    expect(screen.queryByRole('region', { name: 'Sigue jugando' })).not.toBeInTheDocument();
  });
});

describe('getRelatedQuizzes', () => {
  beforeEach(() => {
    dbMocks.filters = [];
    dbMocks.limit = 0;
    dbMocks.createClientCalls = 0;
    dbMocks.quizzes = [
      { id: 'q2', slug: 'science-quiz-2', category_id: 'cat-science' },
      { id: 'q3', slug: 'science-quiz-3', category_id: 'cat-science' },
    ];
  });

  it('filtra por categoría en la query antes del límite', async () => {
    const related = await getRelatedQuizzes('science-quiz-1', 'science', 'en');

    expect(related).toHaveLength(2);
    expect(related[0].category?.slug).toBe('science');
    // La categoría se aplica en la base, no sobre un top global por plays.
    expect(dbMocks.filters).toContain('eq:category_id=cat-science');
    expect(dbMocks.filters).toContain('eq:language=en');
    expect(dbMocks.filters).toContain('neq:slug=science-quiz-1');
    expect(dbMocks.limit).toBe(3);
  });

  it('devuelve [] sin tocar la base cuando el quiz no tiene categoría', async () => {
    expect(await getRelatedQuizzes('science-quiz-1', null, 'en')).toEqual([]);
    expect(dbMocks.createClientCalls).toBe(0);
  });

  it('cae al catálogo local cuando la categoría no existe', async () => {
    const related = await getRelatedQuizzes('x', 'categoria-inexistente', 'en');

    expect(Array.isArray(related)).toBe(true);
    expect(related.every((quiz) => quiz.category?.slug === 'categoria-inexistente')).toBe(true);
  });
});
