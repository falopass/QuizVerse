import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExploreEditorialPage } from '@/components/home/explore-editorial-page';
import type { Category, Quiz } from '@/types/quiz';

function makeQuiz(overrides: Partial<Quiz>): Quiz {
  return {
    id: overrides.id ?? 'q1',
    slug: overrides.slug ?? 'quiz-1',
    title: overrides.title ?? 'Quiz 1',
    description: 'desc',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'easy',
    language: 'en',
    questions: [],
    results: null,
    tags: [],
    estimated_minutes: 5,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: null,
    updated_at: null,
    created_at: '2026-01-01',
    ...overrides,
  };
}

const CATEGORY_FIXTURES: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: 'movies-tv', name: 'Movies & TV' },
  { slug: 'anime-manga', name: 'Anime & Manga' },
  { slug: 'gaming', name: 'Gaming' },
  { slug: 'music', name: 'Music' },
  { slug: 'lifestyle', name: 'Lifestyle' },
  { slug: 'culture', name: 'Culture' },
  { slug: 'literature', name: 'Literature' },
  { slug: 'pop-culture', name: 'Pop Culture' },
  { slug: 'technology', name: 'Technology' },
  { slug: 'relationships', name: 'Relationships' },
  { slug: 'food-drink', name: 'Food & Drink' },
  { slug: 'science', name: 'Science' },
  { slug: 'animals', name: 'Animals' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'geography', name: 'Geography' },
  { slug: 'history', name: 'History' },
];

const CATEGORIES: Category[] = CATEGORY_FIXTURES.map((fixture, index) => ({
  id: `cat-${fixture.slug}`,
  name: fixture.name,
  slug: fixture.slug,
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 5,
  sort_order: index + 1,
}));

const QUIZZES = [
  makeQuiz({ id: 'q1', slug: 'quiz-1', title: 'Quiz 1', plays_count: 100 }),
];

const COPY = {
  title: 'Explora',
  subtitle: 'Subtítulo',
  searchPlaceholder: 'Busca un quiz',
  emptyTitle: 'Nada por aquí',
  emptyBody: 'Prueba otro filtro',
  allCategories: 'Todas',
};

function renderPage(locale: 'es' | 'en') {
  return render(
    <ExploreEditorialPage
      locale={locale}
      quizzes={QUIZZES}
      categories={CATEGORIES}
      copy={COPY}
    />
  );
}

describe('Enlaces del explorador a los hubs de categoría', () => {
  it('enlaza las 16 categorías pobladas en /es', () => {
    const { container } = renderPage('es');

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href^="/es/category/"]'),
    ];
    const hrefs = links.map((link) => link.getAttribute('href'));

    expect(links).toHaveLength(16);
    for (const { slug } of CATEGORY_FIXTURES) {
      expect(hrefs).toContain(`/es/category/${slug}`);
    }
  });

  it('enlaza las 16 categorías pobladas en /en', () => {
    const { container } = renderPage('en');

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href^="/en/category/"]'),
    ];
    const hrefs = links.map((link) => link.getAttribute('href'));

    expect(links).toHaveLength(16);
    for (const { slug } of CATEGORY_FIXTURES) {
      expect(hrefs).toContain(`/en/category/${slug}`);
    }
  });

  it('enlaza también la categoría 16.ª de la lista, la que antes se caía por el slice', () => {
    renderPage('es');

    const last = screen.getByRole('link', { name: 'Historia' });
    expect(last).toHaveAttribute('href', '/es/category/history');
  });
});
