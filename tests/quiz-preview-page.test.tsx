import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  quizRow: { data: null as Record<string, unknown> | null, error: null as unknown },
  categoryRow: { data: null as Record<string, unknown> | null, error: null as unknown },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => mocks.quizRow }),
          maybeSingle: async () => (table === 'categories' ? mocks.categoryRow : mocks.quizRow),
        }),
      }),
    }),
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

import QuizPreviewPage from '@/app/[locale]/my-quizzes/[id]/preview/page';

const USER = { id: 'creator-1' };
const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

const quizRow = () => ({
  id: QUIZ_ID,
  creator_id: USER.id,
  category_id: null,
  title: 'Mi borrador',
  slug: 'mi-borrador',
  description: 'Una premisa',
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'easy',
  language: 'es',
  questions: [
    {
      id: 'q1',
      question: '¿Capital de Chile?',
      options: [
        { id: 'a', text: 'Santiago', is_correct: true },
        { id: 'b', text: 'Lima', is_correct: false },
      ],
    },
  ],
  results: null,
  tags: [],
  estimated_minutes: 3,
  question_count: 1,
  plays_count: 0,
  shares_count: 0,
  avg_score: null,
  likes_count: 0,
  status: 'draft',
  is_featured: false,
  is_ai_generated: false,
  featured_at: null,
  published_at: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
});

function props(locale = 'es') {
  return { params: Promise.resolve({ locale, id: QUIZ_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.quizRow = { data: quizRow(), error: null };
  mocks.categoryRow = { data: null, error: null };
});

describe('vista previa del quiz', () => {
  it('pinta el contenido completo del borrador sin la clave de respuestas', async () => {
    const { container } = render(await QuizPreviewPage(props()));

    expect(screen.getByRole('heading', { name: 'Mi borrador' })).toBeInTheDocument();
    expect(screen.getByText('¿Capital de Chile?')).toBeInTheDocument();
    expect(screen.getByText('Santiago')).toBeInTheDocument();
    expect(screen.getByText('Lima')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    // La clave de respuestas nunca sale al navegador, ni siquiera en el HTML
    // server-rendered de la vista previa del propio autor.
    expect(container.innerHTML).not.toContain('is_correct');
  });

  it('enlaza a editar y a volver a Mis quizzes', async () => {
    render(await QuizPreviewPage(props()));

    expect(screen.getByRole('link', { name: 'Editar datos' })).toHaveAttribute(
      'href',
      `/es/my-quizzes/${QUIZ_ID}/edit`
    );
    expect(screen.getByRole('link', { name: 'Volver a Mis quizzes' })).toHaveAttribute(
      'href',
      '/es/my-quizzes'
    );
  });

  it('devuelve 404 si el quiz no es del autor', async () => {
    mocks.quizRow = { data: null, error: null };

    await expect(QuizPreviewPage(props())).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('redirige a login sin sesión', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(QuizPreviewPage(props())).rejects.toThrow(
      `NEXT_REDIRECT:/es/login?redirect=${encodeURIComponent(`/es/my-quizzes/${QUIZ_ID}/preview`)}`
    );
  });
});
