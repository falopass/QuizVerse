import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  deleteQuiz: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/quiz.actions', () => ({
  deleteQuiz: mocks.deleteQuiz,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MyQuizzesList, type MyQuizRow } from '@/components/quiz/my-quizzes-list';

const QUIZZES: MyQuizRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'quiz-borrador',
    title: 'Quiz en borrador',
    status: 'draft',
    quiz_type: 'trivia',
    language: 'es',
    plays_count: 0,
    likes_count: 0,
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'quiz-en-revision',
    title: 'Quiz en revisión',
    status: 'pending',
    quiz_type: 'personality',
    language: 'es',
    plays_count: 0,
    likes_count: 0,
    created_at: '2026-10-02T10:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'quiz-publicado',
    title: 'Quiz publicado',
    status: 'published',
    quiz_type: 'trivia',
    language: 'en',
    plays_count: 12,
    likes_count: 3,
    created_at: '2026-10-03T10:00:00Z',
  },
];

beforeEach(() => {
  mocks.deleteQuiz.mockReset();
  mocks.deleteQuiz.mockResolvedValue({ success: true });
  mocks.refresh.mockReset();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  );
});

describe('MyQuizzesList', () => {
  it('muestra cada quiz con el chip de su estado', () => {
    render(<MyQuizzesList quizzes={QUIZZES} locale="es" />);

    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();

    // El enlace usa el idioma del quiz, no el de la página.
    const published = screen.getByRole('link', { name: 'Quiz publicado' });
    expect(published).toHaveAttribute('href', '/en/quiz/quiz-publicado');
    expect(screen.queryByRole('link', { name: 'Quiz en borrador' })).not.toBeInTheDocument();
  });

  it('borra un quiz llamando a la action con su id y refresca', async () => {
    render(<MyQuizzesList quizzes={QUIZZES} locale="es" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Borrar' })[1]);

    await waitFor(() =>
      expect(mocks.deleteQuiz).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222')
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it('no llama a la action si se cancela la confirmación', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );
    render(<MyQuizzesList quizzes={QUIZZES} locale="es" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Borrar' })[0]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.deleteQuiz).not.toHaveBeenCalled();
  });

  it('muestra el error localizado cuando la action falla', async () => {
    mocks.deleteQuiz.mockResolvedValue({
      success: false,
      code: 'forbidden',
      error: 'That quiz is not yours.',
    });
    render(<MyQuizzesList quizzes={QUIZZES} locale="es" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Borrar' })[0]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ese quiz no es tuyo.');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('cae al mensaje genérico con un código sin copy propia', async () => {
    mocks.deleteQuiz.mockResolvedValue({
      success: false,
      code: 'unexpected',
      error: 'relation "quizzes" does not exist',
    });
    render(<MyQuizzesList quizzes={QUIZZES} locale="en" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not delete the quiz right now.');
    expect(alert).not.toHaveTextContent('relation');
  });

  it('ofrece crear un quiz cuando la lista está vacía', () => {
    render(<MyQuizzesList quizzes={[]} locale="en" />);

    expect(screen.getByText(/have not created any quizzes/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a quiz' })).toHaveAttribute(
      'href',
      '/en/create'
    );
  });
});
