import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    language: 'es',
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

const CATEGORIES: Category[] = [
  {
    id: 'c1',
    name: 'Cine',
    slug: 'cine-test',
    description: null,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 10,
    sort_order: 0,
  },
  {
    id: 'c2',
    name: 'Música',
    slug: 'music',
    description: null,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 5,
    sort_order: 1,
  },
];

const COPY = {
  title: 'Explora',
  subtitle: 'Subtítulo',
  searchPlaceholder: 'Busca un quiz',
  emptyTitle: 'Nada por aquí',
  emptyBody: 'Prueba otro filtro',
  allCategories: 'Todas',
};

const quiz = (plays: number, id: string) =>
  makeQuiz({ id, slug: id, title: `Quiz ${id}`, plays_count: plays });

const featuredQuiz = (plays: number, id: string) =>
  makeQuiz({ id, slug: id, title: `Quiz ${id}`, plays_count: plays, is_featured: true });

function renderPage(quizzes: Quiz[]) {
  return render(
    <ExploreEditorialPage locale="es" quizzes={quizzes} categories={CATEGORIES} copy={COPY} />
  );
}

describe('Explorador: prueba social de partidas (F11)', () => {
  it('oculta «Partidas en vista» bajo 1.000 y muestra el conteo de categorías', () => {
    renderPage([quiz(32, 'q1'), quiz(10, 'q2')]);

    expect(screen.queryByText('Partidas en vista')).not.toBeInTheDocument();
    const metric = screen.getByText('Categorías').parentElement!;
    expect(within(metric).getByText('2')).toBeInTheDocument();
  });

  it('muestra «Partidas en vista» desde 1.000 partidas en vista', () => {
    renderPage([quiz(600, 'q1'), quiz(400, 'q2')]);

    expect(screen.getByText('Partidas en vista')).toBeInTheDocument();
    expect(screen.queryByText('Categorías')).not.toBeInTheDocument();
  });

  it('oculta las partidas de la tarjeta de pulso bajo 1.000', () => {
    renderPage([quiz(32, 'q1'), quiz(10, 'q2')]);

    expect(screen.queryByText(/partidas/)).not.toBeInTheDocument();
  });

  it('muestra las partidas del pulso desde 1.000', () => {
    renderPage([featuredQuiz(10, 'q1'), quiz(1200, 'q2')]);

    expect(screen.getByText(/partidas/)).toBeInTheDocument();
  });
});
