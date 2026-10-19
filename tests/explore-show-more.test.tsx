import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
    created_at: '2026-01-01',
    ...overrides,
  };
}

const CINE: Category = {
  id: 'c1',
  name: 'Cine',
  slug: 'cine-test',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 20,
  sort_order: 0,
};

const QUIZZES = Array.from({ length: 30 }, (_, index) =>
  makeQuiz({
    id: `q${index}`,
    slug: `quiz-${index}`,
    title: `Quiz ${index}`,
    category: index < 20 ? CINE : null,
  })
);

const COPY = {
  title: 'Explora',
  subtitle: 'Subtítulo',
  searchPlaceholder: 'Busca un quiz',
  emptyTitle: 'Nada por aquí',
  emptyBody: 'Prueba otro filtro',
  allCategories: 'Todas',
};

function renderPage() {
  return render(
    <ExploreEditorialPage locale="es" quizzes={QUIZZES} categories={[CINE]} copy={COPY} />
  );
}

function quizLinks(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLAnchorElement>('a[href*="/quiz/"]')];
}

describe('Explorador: botón «Ver más»', () => {
  it('limita el primer render a 18 tarjetas y ofrece los 12 restantes', () => {
    const { container } = renderPage();

    expect(quizLinks(container)).toHaveLength(18);

    const button = screen.getByRole('button', { name: 'Ver los 12 restantes' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'explore-grid');
    expect(document.getElementById('explore-grid')).toBeInTheDocument();
  });

  it('renderiza el resto al hacer clic y permite colapsar', () => {
    const { container } = renderPage();

    const button = screen.getByRole('button', { name: 'Ver los 12 restantes' });
    fireEvent.click(button);

    expect(quizLinks(container)).toHaveLength(30);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveTextContent('Mostrar menos');

    fireEvent.click(button);
    expect(quizLinks(container)).toHaveLength(18);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('se reinicia al cambiar de categoría y recalcula el restante', () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Ver los 12 restantes' }));
    expect(quizLinks(container)).toHaveLength(30);

    fireEvent.click(screen.getByRole('button', { name: 'C Cine' }));

    expect(screen.getByRole('status')).toHaveTextContent('20 quizzes tras filtros');
    expect(quizLinks(container)).toHaveLength(18);

    const button = screen.getByRole('button', { name: 'Ver los 2 restantes' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(quizLinks(container)).toHaveLength(20);
  });
});
