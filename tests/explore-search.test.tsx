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

const QUIZZES = [
  makeQuiz({ id: 'q-musica', slug: 'musica-90', title: 'Música de los 90' }),
  makeQuiz({
    id: 'q-pelicula',
    slug: 'que-pelicula',
    title: '¿Qué película eres?',
    tags: ['cocina'],
  }),
];

const COPY = {
  title: 'Explora',
  subtitle: 'Subtítulo',
  searchPlaceholder: 'Busca un quiz',
  emptyTitle: 'Nada por aquí',
  emptyBody: 'Prueba otro filtro',
  allCategories: 'Todas',
};

function renderPage(quizzes: Quiz[] = QUIZZES) {
  return render(<ExploreEditorialPage locale="es" quizzes={quizzes} categories={[]} copy={COPY} />);
}

function search(value: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
}

describe('Búsqueda del explorador sin acentos', () => {
  it('«musica» encuentra «Música de los 90»', () => {
    renderPage();
    search('musica');

    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
    expect(screen.getAllByText('Música de los 90').length).toBeGreaterThan(0);
    expect(screen.queryByText('¿Qué película eres?')).not.toBeInTheDocument();
  });

  it('«pelicula» encuentra «¿Qué película eres?»', () => {
    renderPage();
    search('pelicula');

    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
    expect(screen.getAllByText('¿Qué película eres?').length).toBeGreaterThan(0);
    expect(screen.queryByText('Música de los 90')).not.toBeInTheDocument();
  });

  it('«Música» con tilde sigue filtrando igual', () => {
    renderPage();
    search('Música');

    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
    expect(screen.getAllByText('Música de los 90').length).toBeGreaterThan(0);
  });

  it('una query vacía no filtra', () => {
    renderPage();
    search('musica');
    search('   ');

    expect(screen.getByRole('status')).toHaveTextContent('2 quizzes tras filtros');
  });

  it('una query de solo diacríticos equivale a búsqueda vacía', () => {
    renderPage();
    search('́');

    expect(screen.getByRole('status')).toHaveTextContent('2 quizzes tras filtros');
  });

  it('«ñ» sigue siendo una letra distinta de «n»', () => {
    renderPage([
      makeQuiz({ id: 'q-anno', slug: 'ano', title: 'Ano' }),
      makeQuiz({ id: 'q-anya', slug: 'ano-nuevo', title: 'Año nuevo' }),
    ]);

    search('año');
    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
    expect(screen.getAllByText('Año nuevo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ano')).not.toBeInTheDocument();

    search('ano');
    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
    expect(screen.getAllByText('Ano').length).toBeGreaterThan(0);
    expect(screen.queryByText('Año nuevo')).not.toBeInTheDocument();
  });

  it('reconoce «ñ» precompuesta y descompuesta', () => {
    renderPage([makeQuiz({ id: 'q-anya', slug: 'ano-nuevo', title: 'Año nuevo' })]);

    search('año');
    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');

    search('año');
    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
  });
});
