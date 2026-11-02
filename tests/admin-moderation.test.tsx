import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isAdmin: false,
  queueRows: [] as unknown[],
  queueCount: 0 as number,
  queueError: null as { message: string } | null,
  quizRow: null as unknown,
  reportRows: [] as unknown[],
  statusFilter: vi.fn(),
  rangeFilter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

const supabaseStub = {
  from: (table: string) => {
    if (table === 'quiz_reports') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: mocks.reportRows, error: null }),
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: (_col: string, value: unknown) => {
          mocks.statusFilter(value);
          return {
            order: () => ({
              range: async (from: number, to: number) => {
                mocks.rangeFilter(from, to);
                return { data: mocks.queueRows, error: mocks.queueError, count: mocks.queueCount };
              },
            }),
            maybeSingle: async () => ({ data: mocks.quizRow, error: null }),
          };
        },
      }),
    };
  },
};

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: async () => ({
    supabase: supabaseStub,
    user: mocks.user,
    isAdmin: mocks.isAdmin,
  }),
}));

import AdminModerationPage from '@/app/[locale]/admin/moderacion/page';
import AdminQuizReviewPage from '@/app/[locale]/admin/quizzes/[id]/page';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

const QUEUE_ROW = {
  id: QUIZ_ID,
  slug: 'trivia-harry-potter',
  title: 'Trivia de Harry Potter',
  status: 'pending',
  quiz_type: 'trivia',
  language: 'es',
  question_count: 8,
  created_at: '2026-10-30T12:00:00Z',
  category: { name: 'Movies & TV', slug: 'movies-tv' },
  creator: { username: 'diego', display_name: 'Diego' },
};

const FULL_QUIZ = {
  ...QUEUE_ROW,
  description: 'Para verdaderos fans.',
  difficulty: 'medium',
  plays_count: 0,
  likes_count: 0,
  shares_count: 0,
  estimated_minutes: 3,
  tags: ['harry-potter'],
  is_ai_generated: false,
  is_featured: false,
  published_at: null,
  questions: [
    {
      id: 'q1',
      question: '¿Casa de Harry?',
      options: [
        { id: 'a', text: 'Gryffindor', is_correct: true },
        { id: 'b', text: 'Slytherin', is_correct: false },
        { id: 'c', text: 'Hufflepuff', is_correct: false },
      ],
      explanation: 'El sombrero lo dudó, pero fue Gryffindor.',
    },
  ],
  results: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'admin-1' };
  mocks.isAdmin = true;
  mocks.queueRows = [QUEUE_ROW];
  mocks.queueCount = 1;
  mocks.queueError = null;
  mocks.quizRow = FULL_QUIZ;
  mocks.reportRows = [];
});

describe('página /admin/moderacion', () => {
  it('redirige a login sin sesión', async () => {
    mocks.user = null;
    mocks.isAdmin = false;
    await expect(
      AdminModerationPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/es/login');
  });

  it('devuelve 404 a un usuario que no es admin', async () => {
    mocks.isAdmin = false;
    await expect(
      AdminModerationPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('lista los pendientes con autor, tipo, idioma y categoría', async () => {
    render(
      await AdminModerationPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({}),
      })
    );
    expect(screen.getByRole('heading', { name: 'Cola de moderación' })).toBeInTheDocument();
    expect(screen.getByText('Trivia de Harry Potter')).toBeInTheDocument();
    expect(
      screen.getByText(/Trivia · es · Movies & TV · 8 preguntas · por Diego/)
    ).toBeInTheDocument();
    expect(mocks.statusFilter).toHaveBeenCalledWith('pending');
    for (const link of screen.getAllByRole('link', { name: /Trivia de Harry Potter|Revisar/ })) {
      expect(link).toHaveAttribute('href', `/es/admin/quizzes/${QUIZ_ID}`);
    }
  });

  it('filtra rechazados con ?estado=rejected', async () => {
    mocks.queueRows = [{ ...QUEUE_ROW, status: 'rejected' }];
    render(
      await AdminModerationPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ estado: 'rejected' }),
      })
    );
    expect(mocks.statusFilter).toHaveBeenCalledWith('rejected');
    // El chip del quiz y la pestaña activa muestran el estado.
    expect(screen.getAllByText('Rejected').length).toBeGreaterThanOrEqual(2);
  });

  it('muestra estado de error cuando la consulta falla', async () => {
    mocks.queueRows = [];
    mocks.queueError = { message: 'rls' };
    render(
      await AdminModerationPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({}),
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar la cola');
  });

  it('pagina la cola: pide el rango correcto y enlaza Anterior/Siguiente', async () => {
    mocks.queueCount = 120; // 3 páginas de 50
    render(
      await AdminModerationPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({ pagina: '2' }),
      })
    );
    expect(mocks.rangeFilter).toHaveBeenCalledWith(50, 99);
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Anterior' })).toHaveAttribute(
      'href',
      '/es/admin/moderacion'
    );
    expect(screen.getByRole('link', { name: 'Siguiente →' })).toHaveAttribute(
      'href',
      '/es/admin/moderacion?pagina=3'
    );
  });

  it('la paginación conserva el filtro de rechazados', async () => {
    mocks.queueCount = 60;
    mocks.queueRows = [{ ...QUEUE_ROW, status: 'rejected' }];
    render(
      await AdminModerationPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ estado: 'rejected' }),
      })
    );
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/en/admin/moderacion?estado=rejected&pagina=2'
    );
  });
});

describe('página /admin/quizzes/[id]', () => {
  const renderPage = (id = QUIZ_ID, locale = 'es') =>
    AdminQuizReviewPage({ params: Promise.resolve({ locale, id }) });

  it('redirige a login sin sesión', async () => {
    mocks.user = null;
    mocks.isAdmin = false;
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/es/login');
  });

  it('devuelve 404 a un usuario que no es admin', async () => {
    mocks.isAdmin = false;
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('devuelve 404 para un id que no es uuid', async () => {
    await expect(renderPage('no-es-uuid')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('el admin ve todas las preguntas con la respuesta correcta marcada', async () => {
    render(await renderPage());

    expect(screen.getByRole('heading', { name: 'Trivia de Harry Potter' })).toBeInTheDocument();
    expect(screen.getByText(/¿Casa de Harry\?/)).toBeInTheDocument();
    for (const option of ['Gryffindor', 'Slytherin', 'Hufflepuff']) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }
    // La clave solo se renderiza en servidor: una sola opción marcada.
    const marks = screen.getAllByText('Correcta');
    expect(marks).toHaveLength(1);
    expect(marks[0].parentElement).toHaveTextContent('Gryffindor');
    expect(screen.getByText(/Explicación:/)).toBeInTheDocument();
    // Acciones de veredicto presentes.
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar quiz' })).toBeInTheDocument();
  });

  it('muestra los reportes abiertos del quiz', async () => {
    mocks.reportRows = [
      {
        id: 'r1',
        reason: 'incorrect_info',
        details: 'La pregunta 1 está mal.',
        reporter_id: 'u2',
        created_at: '2026-11-01T10:00:00Z',
      },
    ];
    render(await renderPage());
    expect(screen.getByText('Información incorrecta')).toBeInTheDocument();
    expect(screen.getByText('La pregunta 1 está mal.')).toBeInTheDocument();
  });
});
