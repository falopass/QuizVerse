import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExploreEditorialPage } from '@/components/home/explore-editorial-page';
import type { Quiz } from '@/types/quiz';

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

const QUIZZES = [
  makeQuiz({ id: 'q-low', slug: 'low', title: 'Low plays', plays_count: 10, is_featured: true }),
  makeQuiz({ id: 'q-top', slug: 'top', title: 'Top plays', plays_count: 500, likes_count: 3 }),
  makeQuiz({ id: 'q-mid', slug: 'mid', title: 'Mid plays', plays_count: 100, likes_count: 50 }),
];

const COPY = {
  title: 'Explora',
  subtitle: 'Subtítulo',
  searchPlaceholder: 'Busca un quiz',
  emptyTitle: 'Nada por aquí',
  emptyBody: 'Prueba otro filtro',
  allCategories: 'Todas',
};

function renderPage() {
  return render(<ExploreEditorialPage locale="es" quizzes={QUIZZES} categories={[]} copy={COPY} />);
}

describe('Filtros del explorador', () => {
  it('expone aria-pressed en los grupos de mood y categoría y cambia al click', () => {
    renderPage();

    const allEnergy = screen.getByRole('button', { name: 'Toda la energía' });
    const trivia = screen.getByRole('button', { name: 'Trivia' });
    expect(allEnergy).toHaveAttribute('aria-pressed', 'true');
    expect(trivia).toHaveAttribute('aria-pressed', 'false');

    const allCategories = screen.getByRole('button', { name: 'Todas' });
    expect(allCategories).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(trivia);
    expect(trivia).toHaveAttribute('aria-pressed', 'true');
    expect(allEnergy).toHaveAttribute('aria-pressed', 'false');
  });

  it('agrupa los filtros con role=group y etiqueta accesible', () => {
    renderPage();
    expect(screen.getByRole('group', { name: 'Explorar' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Carriles editoriales' })).toBeInTheDocument();
  });

  it('anuncia el contador de resultados en una región status', () => {
    renderPage();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('3 quizzes tras filtros');
  });

  it('mantiene la región status montada cuando el filtro deja cero resultados', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByRole('status')).toHaveTextContent('0 quizzes tras filtros');
  });

  it('marca la búsqueda como type=search', () => {
    renderPage();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('ordena por partidas jugadas al elegir «Más jugados»', () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Más jugados' }));

    const quizLinks = [...container.querySelectorAll<HTMLAnchorElement>('a[href*="/quiz/"]')];
    expect(quizLinks.map((link) => link.getAttribute('href'))).toEqual([
      expect.stringContaining('/quiz/top'),
      expect.stringContaining('/quiz/mid'),
      expect.stringContaining('/quiz/low'),
    ]);
  });
});
