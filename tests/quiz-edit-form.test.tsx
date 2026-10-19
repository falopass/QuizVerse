import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  updateQuiz: vi.fn(),
  deleteQuiz: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/quiz.actions', () => ({
  updateQuiz: mocks.updateQuiz,
  deleteQuiz: mocks.deleteQuiz,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { QuizEditForm, type EditableQuiz } from '@/components/quiz/quiz-edit-form';
import { MyQuizzesList, type MyQuizRow } from '@/components/quiz/my-quizzes-list';
import type { Category } from '@/types/quiz';

const QUIZ: EditableQuiz = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Quiz de capitales',
  description: 'Adivina la capital.',
  category_id: 'cat-1',
  quiz_type: 'trivia',
  difficulty: 'medium',
  language: 'es',
  tags: ['geografía', 'capitales'],
  estimated_minutes: 4,
};

const CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    name: 'Geografía',
    slug: 'geography',
    description: null,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 2,
    sort_order: 1,
  },
];

beforeEach(() => {
  mocks.updateQuiz.mockReset();
  mocks.updateQuiz.mockResolvedValue({ success: true });
  mocks.push.mockReset();
  mocks.refresh.mockReset();
});

describe('QuizEditForm', () => {
  it('prellena los campos con los datos del quiz', () => {
    render(<QuizEditForm quiz={QUIZ} categories={CATEGORIES} locale="es" />);

    expect(screen.getByLabelText('Título')).toHaveValue('Quiz de capitales');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Adivina la capital.');
    expect(screen.getByLabelText('Categoría')).toHaveValue('cat-1');
    expect(screen.getByLabelText('Dificultad')).toHaveValue('medium');
    expect(screen.getByLabelText('Etiquetas')).toHaveValue('geografía, capitales');
    expect(screen.getByLabelText('Minutos estimados')).toHaveValue(4);
  });

  it('envía los valores del formulario con los tags como array', async () => {
    render(<QuizEditForm quiz={QUIZ} categories={CATEGORIES} locale="es" />);

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Capitales del mundo' } });
    fireEvent.change(screen.getByLabelText('Etiquetas'), {
      target: { value: ' mapas , capitales ,, ' },
    });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(mocks.updateQuiz).toHaveBeenCalledWith(QUIZ.id, {
        title: 'Capitales del mundo',
        description: 'Adivina la capital.',
        category_id: null,
        difficulty: 'medium',
        tags: ['mapas', 'capitales'],
        estimated_minutes: 4,
      })
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/my-quizzes'));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('muestra el error localizado cuando la action falla', async () => {
    mocks.updateQuiz.mockResolvedValue({
      success: false,
      code: 'forbidden',
      error: 'That quiz is not yours.',
    });
    render(<QuizEditForm quiz={QUIZ} categories={CATEGORIES} locale="es" />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ese quiz no es tuyo.');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('cae al mensaje genérico con un código sin copy propia', async () => {
    mocks.updateQuiz.mockResolvedValue({
      success: false,
      code: 'unexpected',
      error: 'connection refused',
    });
    render(<QuizEditForm quiz={QUIZ} categories={CATEGORIES} locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not save the changes right now.');
    expect(alert).not.toHaveTextContent('connection refused');
  });
});

describe('MyQuizzesList edición', () => {
  it('cada fila enlaza a su página de edición', () => {
    const quizzes: MyQuizRow[] = [
      {
        id: QUIZ.id,
        slug: 'quiz-de-capitales',
        title: 'Quiz de capitales',
        status: 'draft',
        quiz_type: 'trivia',
        language: 'es',
        plays_count: 0,
        likes_count: 0,
        created_at: '2026-10-01T10:00:00Z',
      },
    ];
    render(<MyQuizzesList quizzes={quizzes} locale="es" />);

    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      `/es/my-quizzes/${QUIZ.id}/edit`
    );
  });
});
