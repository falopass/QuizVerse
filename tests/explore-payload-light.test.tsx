/**
 * QUAL-51: la página del explorador (`/[locale]/quiz`) nunca manda al
 * navegador las preguntas, los resultados ni la clave de respuestas, y
 * proyecta cada quiz a la fila mínima que pintan las tarjetas y los filtros.
 *
 * `ExploreEditorialPage` es un componente cliente: todo lo que recibe cruza
 * al payload RSC. Este test fija que la proyección no deja campos pesados ni
 * rompe los campos que usan las tarjetas.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Category, ExploreCardQuiz, Quiz } from '@/types/quiz';

const exploreMocks = vi.hoisted(() => ({
  lastProps: null as { quizzes: ExploreCardQuiz[]; categories: Category[] } | null,
}));

vi.mock('@/lib/data/public', () => ({
  getExplorePayload: vi.fn(async () => ({
    quizzes: QUIZZES_WITH_SECRETS,
    categories: [MOVIES],
  })),
}));

vi.mock('@/lib/i18n/dictionaries', () => ({
  hasLocale: (locale: string) => locale === 'es' || locale === 'en',
  getDictionary: vi.fn(async () => ({
    explore: {
      title: 'Explora',
      subtitle: 'Subtítulo',
      searchPlaceholder: 'Busca un quiz',
      emptyTitle: 'Nada por aquí',
      emptyBody: 'Prueba otro filtro',
      allCategories: 'Todas',
    },
  })),
}));

vi.mock('@/components/home/explore-editorial-page', () => ({
  ExploreEditorialPage: (props: { quizzes: ExploreCardQuiz[]; categories: Category[] }) => {
    exploreMocks.lastProps = props;
    return <div data-testid="explore-editorial" />;
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import LocalizedQuizExplorerPage from '@/app/[locale]/quiz/page';

const MOVIES: Category = {
  id: 'cat-movies',
  name: 'Cine y TV',
  slug: 'movies-tv',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 2,
  sort_order: 0,
};

// Quizzes tal como salen de la DB: con preguntas, clave y resultados. La
// página tiene que recortarlos antes de entregarlos al componente cliente.
const QUIZZES_WITH_SECRETS: Quiz[] = [
  {
    id: 'q1',
    slug: 'trivia-cine',
    title: 'Trivia de cine',
    description: 'Preguntas de películas',
    cover_image_url: 'https://example.com/cover.jpg',
    quiz_type: 'trivia',
    difficulty: 'easy',
    language: 'es',
    questions: [
      {
        id: 'qq1',
        question: '¿Director de Jaws?',
        explanation: 'Spielberg la dirigió en 1975.',
        options: [
          { id: 'o1', text: 'Spielberg', is_correct: true },
          { id: 'o2', text: 'Lucas', is_correct: false },
        ],
      },
    ],
    correct_answers: ['o1'],
    results: null,
    tags: ['cine'],
    estimated_minutes: 5,
    plays_count: 120,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-01-01',
    updated_at: '2026-01-01',
    created_at: '2026-01-01',
    category: MOVIES,
  } as unknown as Quiz,
  {
    id: 'q2',
    slug: 'que-personaje-eres',
    title: '¿Qué personaje eres?',
    description: 'Test de personalidad',
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: 'easy',
    language: 'es',
    questions: [
      {
        id: 'qq2',
        question: '¿Plan ideal?',
        explanation: 'No hay respuesta correcta.',
        options: [
          { id: 'o3', text: 'Playa', personality_tags: ['aventura'] },
          { id: 'o4', text: 'Sofá', personality_tags: ['relax'] },
        ],
      },
    ],
    correct_answers: ['o3'],
    results: [
      {
        id: 'r1',
        title: 'Aventurero',
        description: 'Te va el riesgo',
        personality_tag: 'aventura',
      },
    ],
    tags: ['personalidad'],
    estimated_minutes: 3,
    plays_count: 45,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-01-01',
    updated_at: '2026-01-01',
    created_at: '2026-01-01',
    category: MOVIES,
  } as unknown as Quiz,
];

async function renderPage() {
  const utils = render(
    await LocalizedQuizExplorerPage({ params: Promise.resolve({ locale: 'es' }) })
  );
  expect(exploreMocks.lastProps).not.toBeNull();
  return utils;
}

const LIGHT_KEYS = [
  'category',
  'cover_image_url',
  'description',
  'estimated_minutes',
  'id',
  'is_featured',
  'likes_count',
  'plays_count',
  'quiz_type',
  'slug',
  'tags',
  'title',
].sort();

describe('explorador: payload ligero (QUAL-51)', () => {
  it('proyecta cada quiz a la fila mínima de la tarjeta', async () => {
    await renderPage();
    const { quizzes } = exploreMocks.lastProps!;

    expect(quizzes).toHaveLength(2);
    for (const quiz of quizzes) {
      expect(Object.keys(quiz).sort()).toEqual(LIGHT_KEYS);
      expect(quiz).not.toHaveProperty('questions');
      expect(quiz).not.toHaveProperty('results');
      expect(quiz).not.toHaveProperty('correct_answers');
      expect(quiz).not.toHaveProperty('visual_profile');
      expect(quiz).not.toHaveProperty('published_at');
      expect(Object.keys(quiz.category!).sort()).toEqual(['id', 'name', 'slug']);
    }
  });

  it('el payload serializado no contiene la clave de respuestas', async () => {
    await renderPage();
    const json = JSON.stringify(exploreMocks.lastProps);

    expect(json).not.toContain('is_correct');
    expect(json).not.toContain('correct_answers');
    expect(json).not.toContain('explanation');
  });

  it('conserva los campos que usan las tarjetas y los filtros', async () => {
    await renderPage();
    const { quizzes, categories } = exploreMocks.lastProps!;

    for (const quiz of quizzes) {
      expect(quiz.title).toBeTruthy();
      expect(quiz.description).toBeTruthy();
      expect(Array.isArray(quiz.tags)).toBe(true);
      expect(typeof quiz.plays_count).toBe('number');
      expect(typeof quiz.likes_count).toBe('number');
      expect(typeof quiz.is_featured).toBe('boolean');
      expect(typeof quiz.estimated_minutes).toBe('number');
      expect(quiz).toHaveProperty('cover_image_url');
      expect(quiz.category?.slug).toBe('movies-tv');
    }
    expect(quizzes[0].title).toBe('Trivia de cine');
    expect(quizzes[1].title).toBe('¿Qué personaje eres?');
    expect(categories).toEqual([MOVIES]);
  });

  it('sigue emitiendo el ItemList del JSON-LD', async () => {
    const { container } = await renderPage();
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const graph = JSON.parse(script!.innerHTML) as {
      '@graph': Array<{ '@type': string; itemListElement?: unknown[] }>;
    };
    const itemList = graph['@graph'].find((node) => node['@type'] === 'ItemList');
    expect(itemList).toBeDefined();
    expect(itemList!.itemListElement!.length).toBeGreaterThan(0);
  });
});
