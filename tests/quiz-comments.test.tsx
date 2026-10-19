import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getQuizComments: vi.fn(),
  createComment: vi.fn(),
  useSupabase: vi.fn(),
}));

vi.mock('@/actions/comments.actions', () => ({
  getQuizComments: mocks.getQuizComments,
  createComment: mocks.createComment,
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/quiz/mi-quiz',
}));

import { QuizComments } from '@/components/quiz/quiz-comments';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
const COMMENT = {
  id: 'comment-1',
  body: 'Buenísimo quiz',
  created_at: '2026-10-19T00:00:00Z',
  author: { username: 'ada', display_name: 'Ada Lovelace', avatar_url: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useSupabase.mockReturnValue({ user: { id: 'user-1' }, loading: false });
  mocks.getQuizComments.mockResolvedValue([]);
});

describe('QuizComments', () => {
  it('pinta los comentarios con autor, fecha y contador', async () => {
    mocks.getQuizComments.mockResolvedValue([COMMENT]);

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText('Buenísimo quiz')).toBeInTheDocument();
    expect(screen.getByText('@ada')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('1 comentario')).toHaveAttribute('aria-live', 'polite');
  });

  it('muestra el estado vacío cuando no hay comentarios', async () => {
    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText('Sé la primera persona en comentar.')).toBeInTheDocument();
  });

  it('si la carga falla cae al estado vacío sin romper la página', async () => {
    mocks.getQuizComments.mockRejectedValue(new Error('boom'));

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText('Sé la primera persona en comentar.')).toBeInTheDocument();
  });

  it('envía con sesión y añade el comentario arriba sin recargar', async () => {
    mocks.createComment.mockResolvedValue({
      success: true,
      comment: { ...COMMENT, id: 'comment-2', body: 'Hola' },
    });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));

    expect(await screen.findByText('Hola')).toBeInTheDocument();
    expect(mocks.createComment).toHaveBeenCalledWith(QUIZ_ID, 'Hola');
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('1 comentario')).toBeInTheDocument();
  });

  it('muestra el error visible y conserva el texto si el envío falla', async () => {
    mocks.createComment.mockResolvedValue({
      success: false,
      code: 'unexpected',
      error: 'boom',
    });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos publicar tu comentario. Inténtalo otra vez.'
    );
    expect(screen.getByRole('textbox')).toHaveValue('Hola');
  });

  it('sin sesión el CTA enlaza al login con retorno a la ficha', async () => {
    mocks.useSupabase.mockReturnValue({ user: null, loading: false });
    mocks.getQuizComments.mockResolvedValue([COMMENT]);

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    const link = await screen.findByRole('link', { name: 'Inicia sesión para comentar' });
    expect(link).toHaveAttribute(
      'href',
      `/es/login?redirect=${encodeURIComponent('/es/quiz/mi-quiz')}`
    );
    expect(screen.queryByRole('button', { name: 'Comentar' })).not.toBeInTheDocument();
  });
});
