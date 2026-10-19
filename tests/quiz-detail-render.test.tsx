/**
 * Tests de render de la ficha `/[locale]/quiz/[slug]` (QUAL-50).
 *
 * La ficha es la página con más valor SEO del sitio: emite un grafo JSON-LD
 * (WebPage + Quiz + BreadcrumbList), enlaza la categoría y los relacionados, y
 * alimenta `/play`. Estas pruebas fijan ese contrato sobre el HTML servido y,
 * sobre todo, que `is_correct` nunca se serializa al navegador.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Category, Quiz } from '@/types/quiz';

const dbMocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getRelatedQuizzes: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getPublishedQuizzes: vi.fn(),
  getQuizBySlug: dbMocks.getQuizBySlug,
  getRelatedQuizzes: dbMocks.getRelatedQuizzes,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

// QuizComments monta el provider de Supabase; no participa en el render SEO.
vi.mock('@/components/quiz/quiz-comments', () => ({
  QuizComments: () => null,
}));

import { QuizDetailPage } from '@/components/home/quiz-detail-page';

const MOVIES: Category = {
  id: 'cat-movies',
  name: 'Cine y televisión',
  slug: 'movies-tv',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 174,
  sort_order: 0,
};

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'movies-trivia',
    title: 'Movies Trivia',
    description: 'A trivia quiz about movies.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    // Cinco preguntas para fijar que la sección solo muestra PREVIEW_QUESTIONS (3).
    // Al menos una opción trae is_correct: la clave no debe llegar jamás al HTML.
    questions: [
      {
        id: 'q1',
        question: '¿Qué película ganó el Óscar en 2020?',
        options: [
          { id: 'q1a', text: 'Parasite', is_correct: true },
          { id: 'q1b', text: '1917' },
        ],
      },
      {
        id: 'q2',
        question: '¿Quién dirigió Tiburón?',
        options: [
          { id: 'q2a', text: 'Spielberg', is_correct: true },
          { id: 'q2b', text: 'Lucas' },
        ],
      },
      {
        id: 'q3',
        question: '¿En qué año se estrenó Matrix?',
        options: [
          { id: 'q3a', text: '1999', is_correct: true },
          { id: 'q3b', text: '2001' },
        ],
      },
      {
        id: 'q4',
        question: '¿Qué estudio hizo Toy Story?',
        options: [
          { id: 'q4a', text: 'Pixar', is_correct: true },
          { id: 'q4b', text: 'DreamWorks' },
        ],
      },
      {
        id: 'q5',
        question: '¿Quién canta la canción de Titanic?',
        options: [
          { id: 'q5a', text: 'Céline Dion', is_correct: true },
          { id: 'q5b', text: 'Madonna' },
        ],
      },
    ],
    results: null,
    tags: ['movies'],
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
    category: MOVIES,
    ...overrides,
  };
}

async function renderDetail(locale: string, quiz: Quiz | null) {
  dbMocks.getQuizBySlug.mockResolvedValue(quiz);
  dbMocks.getRelatedQuizzes.mockResolvedValue([]);
  return render(
    await QuizDetailPage({
      params: Promise.resolve({ locale, slug: 'movies-trivia' }),
    })
  );
}

interface GraphNode {
  '@type'?: string;
  name?: string;
}

function jsonLdGraph(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML) as { '@graph': GraphNode[] };
}

beforeEach(() => {
  dbMocks.getQuizBySlug.mockReset();
  dbMocks.getRelatedQuizzes.mockReset();
});

describe('QuizDetailPage · render SEO', () => {
  it('emite los tres nodos JSON-LD y el Quiz trae el nombre del quiz', async () => {
    const { container } = await renderDetail('es', makeQuiz());
    const types = jsonLdGraph(container)['@graph'].map((node) => node['@type']);

    expect(types).toEqual(['WebPage', 'Quiz', 'BreadcrumbList']);
    const quizNode = jsonLdGraph(container)['@graph'].find((n) => n['@type'] === 'Quiz');
    expect(quizNode?.name).toBe('Movies Trivia');
  });

  it('pinta el h1 con el título, el breadcrumb visible y el enlace a la categoría', async () => {
    await renderDetail('es', makeQuiz());

    expect(screen.getByRole('heading', { level: 1, name: 'Movies Trivia' })).toBeInTheDocument();

    // Breadcrumb visible: Inicio → Explorar → Trivia (hub de tipo) → título.
    const breadcrumbNav = screen.getByRole('navigation', {
      name: 'Ruta de navegación',
    });
    expect(breadcrumbNav).toHaveTextContent('Inicio');
    expect(breadcrumbNav).toHaveTextContent('Movies Trivia');

    // La fila Categoría enlaza el hub de tema.
    expect(screen.getByRole('link', { name: 'Cine y televisión' })).toHaveAttribute(
      'href',
      '/es/category/movies-tv'
    );
  });

  it('«Dentro del quiz» lista solo las 3 primeras preguntas y no fuga is_correct', async () => {
    const { container } = await renderDetail('es', makeQuiz());

    const section = container.querySelector('section[aria-labelledby="inside-quiz"]');
    expect(section).not.toBeNull();
    const items = section!.querySelectorAll('ol > li');
    expect(items).toHaveLength(3);
    expect(section).toHaveTextContent('¿Qué película ganó el Óscar en 2020?');
    expect(section).toHaveTextContent('¿En qué año se estrenó Matrix?');
    expect(section).not.toHaveTextContent('¿Qué estudio hizo Toy Story?');
    expect(section).not.toHaveTextContent('¿Quién canta la canción de Titanic?');

    // Cero fuga de la clave: ni en el preview, ni en el JSON-LD, ni en atributos.
    expect(container.innerHTML).not.toContain('is_correct');
  });

  it('en inglés los textos de la sección cambian de idioma', async () => {
    await renderDetail('en', makeQuiz({ language: 'en' }));

    expect(screen.getByRole('heading', { name: 'Inside the quiz' })).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See all Cine y televisión quizzes/ })).toHaveAttribute(
      'href',
      '/en/category/movies-tv'
    );
  });

  it('si el slug no existe llama a notFound()', async () => {
    await expect(renderDetail('es', null)).rejects.toThrow('notFound');
  });
});
