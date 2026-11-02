import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getQuizComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  setCommentHidden: vi.fn(),
  reportComment: vi.fn(),
  useSupabase: vi.fn(),
}));

vi.mock('@/actions/comments.actions', () => ({
  getQuizComments: mocks.getQuizComments,
  createComment: mocks.createComment,
  deleteComment: mocks.deleteComment,
  setCommentHidden: mocks.setCommentHidden,
  reportComment: mocks.reportComment,
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/quiz/mi-quiz',
}));

import { QuizComments } from '@/components/quiz/quiz-comments';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
const OTHER_QUIZ_ID = '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d';
const COMMENT = {
  id: 'comment-1',
  body: 'Buenísimo quiz',
  created_at: '2026-10-19T00:00:00Z',
  user_id: 'user-1',
  hidden_at: null,
  author: { username: 'ada', display_name: 'Ada Lovelace', avatar_url: null },
};
const FOREIGN_COMMENT = { ...COMMENT, user_id: 'user-2' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  );
  mocks.useSupabase.mockReturnValue({ user: { id: 'user-1' }, loading: false });
  mocks.getQuizComments.mockResolvedValue({
    comments: [],
    total: 0,
    viewerCanModerate: false,
    viewerIsAdmin: false,
  });
});

describe('QuizComments', () => {
  it('pinta los comentarios con autor, fecha y contador', async () => {
    mocks.getQuizComments.mockResolvedValue({ comments: [COMMENT], total: 1 });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText('Buenísimo quiz')).toBeInTheDocument();
    expect(screen.getByText('@ada')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('1 comentario')).toHaveAttribute('aria-live', 'polite');
  });

  it('avisa cuando el total supera la lista mostrada', async () => {
    mocks.getQuizComments.mockResolvedValue({ comments: [COMMENT], total: 60 });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText(/60 comentarios/)).toBeInTheDocument();
    expect(screen.getByText(/Se muestran los 50 más recientes\./)).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay comentarios', async () => {
    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText('Sé la primera persona en comentar.')).toBeInTheDocument();
  });

  it('si la carga falla muestra aviso con reintento, no el estado vacío', async () => {
    mocks.getQuizComments.mockRejectedValue(new Error('boom'));

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findAllByText('No pudimos cargar los comentarios.')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByText('Sé la primera persona en comentar.')).not.toBeInTheDocument();
  });

  it('el reintento vuelve a pedir los comentarios y pinta la lista', async () => {
    mocks.getQuizComments
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ comments: [COMMENT], total: 1 });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Buenísimo quiz')).toBeInTheDocument();
    expect(screen.getByText('1 comentario')).toBeInTheDocument();
    expect(mocks.getQuizComments).toHaveBeenCalledTimes(2);
  });

  it('al cambiar de quiz no muestra los comentarios del anterior', async () => {
    mocks.getQuizComments.mockImplementation(async (quizId: string) =>
      quizId === QUIZ_ID ? { comments: [COMMENT], total: 1 } : { comments: [], total: 0 }
    );

    const { rerender } = render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    expect(await screen.findByText('Buenísimo quiz')).toBeInTheDocument();

    rerender(<QuizComments quizId={OTHER_QUIZ_ID} locale="es" />);

    expect(screen.queryByText('Buenísimo quiz')).not.toBeInTheDocument();
    expect(await screen.findByText('Sé la primera persona en comentar.')).toBeInTheDocument();
    expect(mocks.getQuizComments).toHaveBeenLastCalledWith(OTHER_QUIZ_ID, undefined);
  });

  it('pide el comentario anclado cuando la URL trae #comment-<id>', async () => {
    window.location.hash = '#comment-c-1';

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByText('Sé la primera persona en comentar.')).toBeInTheDocument();
    expect(mocks.getQuizComments).toHaveBeenCalledWith(QUIZ_ID, 'c-1');

    window.location.hash = '';
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
    mocks.getQuizComments.mockResolvedValue({ comments: [COMMENT], total: 1 });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    const link = await screen.findByRole('link', { name: 'Inicia sesión para comentar' });
    expect(link).toHaveAttribute(
      'href',
      `/es/login?redirect=${encodeURIComponent('/es/quiz/mi-quiz')}`
    );
    expect(screen.queryByRole('button', { name: 'Comentar' })).not.toBeInTheDocument();
  });

  it('el autor ve Borrar y quita su comentario al confirmar', async () => {
    mocks.deleteComment.mockResolvedValue({ success: true });
    mocks.getQuizComments.mockResolvedValue({
      comments: [COMMENT],
      total: 1,
      viewerCanModerate: false,
      viewerIsAdmin: false,
    });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));

    expect(mocks.deleteComment).toHaveBeenCalledWith('comment-1');
    expect(await screen.findByText('0 comentarios')).toBeInTheDocument();
    expect(screen.queryByText('Buenísimo quiz')).not.toBeInTheDocument();
  });

  it('un comentario ajeno muestra Reportar y no Borrar para un usuario normal', async () => {
    mocks.getQuizComments.mockResolvedValue({
      comments: [FOREIGN_COMMENT],
      total: 1,
      viewerCanModerate: false,
      viewerIsAdmin: false,
    });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);

    expect(await screen.findByRole('button', { name: 'Reportar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument();
  });

  it('quien modera ve Ocultar y al activarlo queda marcado como oculto', async () => {
    mocks.setCommentHidden.mockResolvedValue({
      success: true,
      hiddenAt: '2026-11-02T00:00:00Z',
    });
    mocks.getQuizComments.mockResolvedValue({
      comments: [FOREIGN_COMMENT],
      total: 1,
      viewerCanModerate: true,
      viewerIsAdmin: false,
    });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));

    expect(mocks.setCommentHidden).toHaveBeenCalledWith('comment-1', true);
    expect(await screen.findByText('Oculto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeInTheDocument();
  });

  it('reporta un comentario desde el modal con motivo', async () => {
    mocks.reportComment.mockResolvedValue({ success: true });
    mocks.getQuizComments.mockResolvedValue({
      comments: [FOREIGN_COMMENT],
      total: 1,
      viewerCanModerate: false,
      viewerIsAdmin: false,
    });

    render(<QuizComments quizId={QUIZ_ID} locale="es" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar' }));
    fireEvent.click(await screen.findByLabelText('Spam o engañoso'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(mocks.reportComment).toHaveBeenCalledWith('comment-1', 'spam', '');
    expect(await screen.findByText('Gracias. Revisaremos este comentario.')).toBeInTheDocument();
  });
});
