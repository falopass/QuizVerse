import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
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

import CreateDonePage from '@/app/[locale]/create/done/page';

const USER = { id: 'user-1' };
const PENDING_QUIZ = { slug: 'mi-quiz', title: 'Mi quiz', status: 'pending' };

function props(slug = 'mi-quiz', locale = 'es') {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({ slug }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.maybeSingle.mockResolvedValue({ data: PENDING_QUIZ, error: null });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle });
  mocks.from.mockReturnValue({ select: mocks.select });
});

describe('página /create/done', () => {
  it('muestra «En revisión» para un quiz pendiente del dueño', async () => {
    render(await CreateDonePage(props()));

    expect(screen.getByRole('heading', { name: 'En revisión' })).toBeInTheDocument();
    expect(screen.getByText(/revisa los quizzes nuevos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis quizzes' })).toHaveAttribute(
      'href',
      '/es/my-quizzes'
    );
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/es');
    expect(mocks.eq).toHaveBeenCalledWith('slug', 'mi-quiz');
    expect(mocks.eq).toHaveBeenCalledWith('creator_id', USER.id);
  });

  it('muestra «In review» en inglés', async () => {
    render(await CreateDonePage(props('mi-quiz', 'en')));

    expect(screen.getByRole('heading', { name: 'In review' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My quizzes' })).toHaveAttribute(
      'href',
      '/en/my-quizzes'
    );
  });

  it('enlaza al quiz cuando ya está publicado (admin)', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { ...PENDING_QUIZ, status: 'published' },
      error: null,
    });

    render(await CreateDonePage(props()));

    expect(screen.getByRole('heading', { name: 'Publicado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el quiz' })).toHaveAttribute(
      'href',
      '/es/quiz/mi-quiz'
    );
  });

  it('devuelve 404 cuando el quiz no existe o no es del usuario', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(CreateDonePage(props('quiz-ajeno'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('devuelve 404 sin slug', async () => {
    await expect(
      CreateDonePage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('redirige a login preservando el slug cuando no hay sesión', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(CreateDonePage(props())).rejects.toThrow(
      `NEXT_REDIRECT:/es/login?redirect=${encodeURIComponent('/es/create/done?slug=mi-quiz')}`
    );
  });
});
