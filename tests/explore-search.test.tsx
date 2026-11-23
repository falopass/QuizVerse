import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const CATEGORY_GAMES: Category = {
  id: 'cat-gaming',
  name: 'Gaming',
  slug: 'gaming',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 50,
  sort_order: 1,
};

describe('Explorador: URL ?q=, atrás/adelante, limpiar filtros, fallback y paginación remota', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('sincroniza ?q= inicial desde la URL y reacciona a popstate (atrás/adelante)', () => {
    window.history.replaceState(null, '', '/es/quiz?q=musica');
    renderPage();

    expect(screen.getByRole('searchbox')).toHaveValue('musica');
    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');

    act(() => {
      window.history.pushState(null, '', '/es/quiz?q=pelicula');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByRole('searchbox')).toHaveValue('pelicula');
    expect(screen.getByRole('status')).toHaveTextContent('1 quizzes tras filtros');
    expect(screen.getAllByText('¿Qué película eres?').length).toBeGreaterThan(0);
  });

  it('muestra botón «Limpiar filtros» en cero resultados y restablece búsqueda y filtros', () => {
    renderPage();
    search('termino-inexistente-xyz');

    expect(screen.getByRole('status')).toHaveTextContent('0 quizzes tras filtros');
    expect(screen.getByRole('heading', { name: 'Nada por aquí' })).toBeInTheDocument();

    const clearButtons = screen.getAllByRole('button', { name: 'Limpiar filtros' });
    expect(clearButtons.length).toBeGreaterThan(0);
    fireEvent.click(clearButtons[0]);

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('2 quizzes tras filtros');
  });

  it('muestra aviso de solo lectura cuando el catálogo está en modo fallback', () => {
    const fallbackQuizzes = [
      makeQuiz({ id: 'launch-es-1', slug: 'launch-1', title: 'Quiz de respaldo 1' }),
    ];
    render(
      <ExploreEditorialPage
        locale="es"
        quizzes={fallbackQuizzes}
        categories={[]}
        isFallback
        copy={COPY}
      />
    );

    expect(screen.getByRole('note')).toHaveTextContent(/respaldo|solo lectura/i);
  });

  it('consulta GET /api/quizzes para búsqueda, siguiente página y reintento ante fallo cuando totalQuizzes > quizzes.length', async () => {
    const initial24 = Array.from({ length: 24 }, (_, idx) =>
      makeQuiz({
        id: `init-${idx}`,
        slug: `init-quiz-${idx}`,
        title: `Quiz inicial ${idx}`,
        category: CATEGORY_GAMES,
      })
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('page=2')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'remote-25',
                slug: 'remote-quiz-25',
                title: 'Quiz remoto 25',
                description: 'Cargado desde /api/quizzes',
                quizType: 'trivia',
                difficulty: 'medium',
                language: 'es',
                questionCount: 8,
                estimatedMinutes: 3,
                plays: 90,
                coverImageUrl: null,
                categoryId: 'cat-gaming',
              },
            ],
            total: 25,
            page: 2,
            limit: 24,
            hasMore: false,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'catalog_unavailable' }), { status: 503 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ExploreEditorialPage
        locale="es"
        quizzes={initial24}
        categories={[CATEGORY_GAMES]}
        totalQuizzes={25}
        copy={COPY}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('25 quizzes tras filtros');
    const loadMoreBtn = screen.getByRole('button', { name: 'Ver los 1 restantes' });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByText('Quiz remoto 25')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/quizzes?locale=es&page=2&limit=24'),
      expect.any(Object)
    );

    // Ahora probamos fallo remoto al filtrar por categoría y botón de reintento.
    fireEvent.click(screen.getByRole('button', { name: 'V Videojuegos' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
