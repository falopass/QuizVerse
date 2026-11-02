import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  range: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  countResult: { count: 45 as number | null, error: null as { message: string } | null },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

// La lista es un componente cliente con server actions: aquí solo importa qué
// recibe de la página (lista vacía vs error, y la página elegida).
vi.mock('@/components/quiz/my-quizzes-list', () => ({
  MyQuizzesList: ({ quizzes }: { quizzes: unknown[] }) => (
    <p data-testid="list">lista:{quizzes.length}</p>
  ),
}));

import MyQuizzesPage from '@/app/[locale]/my-quizzes/page';

const USER = { id: 'user-1' };

function props(page?: string, locale = 'es') {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(page ? { page } : {}),
  };
}

function row(id: string) {
  return {
    id,
    slug: `quiz-${id}`,
    title: `Quiz ${id}`,
    status: 'draft',
    quiz_type: 'trivia',
    language: 'es',
    plays_count: 0,
    likes_count: 0,
    created_at: '2026-10-01T10:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.countResult = { count: 45, error: null };
  // `.eq()` se espera tal cual en la consulta de recuento y encadena `.order()`
  // en la de filas: un thenable con `order` cubre ambas.
  mocks.select.mockReturnValue({
    eq: () => ({
      order: mocks.order,
      then: (resolve: (value: unknown) => unknown) => resolve(mocks.countResult),
    }),
  });
  mocks.order.mockReturnValue({ range: mocks.range });
  mocks.range.mockResolvedValue({ data: [row('1')], error: null });
  mocks.from.mockReturnValue({ select: mocks.select });
});

describe('página /my-quizzes', () => {
  it('distingue un error de una lista vacía', async () => {
    mocks.countResult = { count: null, error: { message: 'boom' } };

    render(await MyQuizzesPage(props()));

    expect(screen.getByText('No pudimos cargar tus quizzes.')).toBeInTheDocument();
    expect(screen.queryByTestId('list')).not.toBeInTheDocument();
  });

  it('también muestra el panel de error si fallan las filas', async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: 'boom' } });

    render(await MyQuizzesPage(props()));

    expect(screen.getByText('No pudimos cargar tus quizzes.')).toBeInTheDocument();
  });

  it('pinta la lista (aunque esté vacía) cuando la consulta funciona', async () => {
    mocks.countResult = { count: 0, error: null };
    mocks.range.mockResolvedValue({ data: [], error: null });

    render(await MyQuizzesPage(props()));

    expect(screen.getByTestId('list')).toHaveTextContent('lista:0');
    expect(screen.queryByText('No pudimos cargar tus quizzes.')).not.toBeInTheDocument();
  });

  it('pagina con ?page y calcula el rango de 20', async () => {
    render(await MyQuizzesPage(props('2')));

    expect(mocks.range).toHaveBeenCalledWith(20, 39);
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/es/my-quizzes?page=1'
    );
    expect(screen.getByRole('link', { name: 'Siguiente' })).toHaveAttribute(
      'href',
      '/es/my-quizzes?page=3'
    );
  });

  it('redirige a la última página válida si ?page quedó fuera de rango', async () => {
    mocks.countResult = { count: 20, error: null };

    await expect(MyQuizzesPage(props('3'))).rejects.toThrow('NEXT_REDIRECT:/es/my-quizzes');
    expect(mocks.range).not.toHaveBeenCalled();
  });

  it('no pinta paginación cuando todo cabe en una página', async () => {
    mocks.countResult = { count: 5, error: null };

    render(await MyQuizzesPage(props()));

    expect(screen.queryByRole('link', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
  });

  it('redirige a login sin sesión', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(MyQuizzesPage(props())).rejects.toThrow(
      `NEXT_REDIRECT:/es/login?redirect=${encodeURIComponent('/es/my-quizzes')}`
    );
  });
});
