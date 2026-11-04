/**
 * Tests del bloque «Más de {franquicia}» en la ficha de quiz.
 *
 * El bloque enlaza el hub `/{locale}/fandom/{slug}` y muestra hasta 4 quizzes
 * hermanos (sin el actual). Solo aparece cuando la franquicia del quiz tiene
 * hub (≥3 quizzes en el idioma); la ficha de un quiz sin franquicia queda
 * igual que antes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Category, Quiz } from '@/types/quiz';
import type { FandomQuizHub, FandomCardQuiz } from '@/lib/data/fandom';

const dbMocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getRelatedQuizzes: vi.fn(),
  getQuizFandom: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getPublishedQuizzes: vi.fn(),
  getQuizBySlug: dbMocks.getQuizBySlug,
  getRelatedQuizzesBySlug: dbMocks.getRelatedQuizzes,
}));

vi.mock('@/lib/data/fandom', () => ({
  getQuizFandom: dbMocks.getQuizFandom,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  usePathname: () => '/en/quiz/x',
}));

// QuizComments monta el provider de Supabase; LikeButton pide estado al
// servidor al montar. Ninguno participa en el bloque de fandom.
vi.mock('@/components/quiz/quiz-comments', () => ({
  QuizComments: () => null,
}));
vi.mock('@/components/shared/like-button', () => ({
  LikeButton: () => null,
}));

import { QuizDetailPage } from '@/components/home/quiz-detail-page';

const ANIME: Category = {
  id: 'cat-anime',
  name: 'Anime & Manga',
  slug: 'anime-manga',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 119,
  sort_order: 0,
};

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'es-trivia-fan-de-frieren',
    title: 'Trivia fan de Frieren',
    description: 'Una trivia de Frieren.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    questions: [],
    results: null,
    tags: ['frieren'],
    estimated_minutes: 3,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: null,
    created_at: '2026-05-21T00:00:00.000Z',
    category: ANIME,
    ...overrides,
  };
}

function card(slug: string, title: string): FandomCardQuiz {
  return {
    id: `id-${slug}`,
    slug,
    title,
    description: null,
    cover_image_url: null,
    quiz_type: 'trivia',
    estimated_minutes: 3,
    plays_count: 0,
    likes_count: 0,
    is_featured: false,
    tags: [],
    category: ANIME,
  };
}

const FRIEREN_HUB: FandomQuizHub = {
  slug: 'frieren',
  name: 'Frieren',
  quizzes: [
    card('es-trivia-fan-de-frieren', 'Trivia fan de Frieren'),
    card('es-frieren-energia', '¿Qué energía de Frieren combina mejor contigo?'),
    card('es-frieren-rol', '¿Qué rol jugarías dentro de Frieren?'),
    card('es-frieren-profundo', '¿Qué tan profundo llega tu conocimiento de Frieren?'),
    card('es-frieren-extra', 'Frieren Bonus Trivia Challenge'),
  ],
};

async function renderDetail(slug = 'es-trivia-fan-de-frieren') {
  return render(await QuizDetailPage({ params: Promise.resolve({ locale: 'es', slug }) }));
}

beforeEach(() => {
  dbMocks.getQuizBySlug.mockReset();
  dbMocks.getRelatedQuizzes.mockReset();
  dbMocks.getQuizFandom.mockReset();
  dbMocks.getQuizBySlug.mockResolvedValue(makeQuiz());
  dbMocks.getRelatedQuizzes.mockResolvedValue([]);
  dbMocks.getQuizFandom.mockResolvedValue(FRIEREN_HUB);
});

describe('QuizDetailPage · «Más de {franquicia}»', () => {
  it('pinta el bloque con enlace al hub y hasta 4 hermanos, sin el quiz actual', async () => {
    await renderDetail();

    expect(screen.getByRole('heading', { level: 2, name: 'Más de Frieren' })).toBeInTheDocument();

    const hubLink = screen.getByRole('link', { name: /Todos los quizzes de Frieren/ });
    expect(hubLink).toHaveAttribute('href', '/es/fandom/frieren');

    const siblings = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/es/quiz/es-frieren-'));
    expect(siblings).toHaveLength(4);
    expect(siblings.map((link) => link.getAttribute('href'))).not.toContain(
      '/es/quiz/es-trivia-fan-de-frieren'
    );
  });

  it('no pinta el bloque cuando el quiz no tiene hub de fandom', async () => {
    dbMocks.getQuizFandom.mockResolvedValue(null);
    await renderDetail('es-trivia-cualquiera');

    expect(screen.queryByText(/Más de /)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Trivia fan de Frieren' })
    ).toBeInTheDocument();
  });
});
