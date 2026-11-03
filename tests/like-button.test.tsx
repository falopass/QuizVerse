import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  likeQuiz: vi.fn(),
  getQuizLikeState: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/actions/quiz.actions', () => ({
  likeQuiz: mocks.likeQuiz,
  getQuizLikeState: mocks.getQuizLikeState,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import { LikeButton } from '@/components/shared/like-button';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

function renderButton(locale: 'en' | 'es' = 'es', initialCount = 7) {
  render(
    <LikeButton
      quizId={QUIZ_ID}
      locale={locale}
      detailPath={`/${locale}/quiz/mi-quiz`}
      initialCount={initialCount}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getQuizLikeState.mockResolvedValue({ authenticated: true, liked: false });
  mocks.likeQuiz.mockResolvedValue({ success: true, liked: true, likesCount: 8 });
});

describe('LikeButton', () => {
  it('aplica el toggle optimista y mantiene el resultado del servidor', async () => {
    renderButton('es', 7);

    const button = await screen.findByRole('button', { name: /Me gusta \(7\)/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    // Optimista: aria-pressed y contador cambian antes de resolver la acción.
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('8');

    await waitFor(() => expect(mocks.likeQuiz).toHaveBeenCalledWith(QUIZ_ID));
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('8');
  });

  it('revierte el estado optimista cuando la acción falla', async () => {
    mocks.likeQuiz.mockResolvedValue({
      success: false,
      code: 'unexpected',
      error: 'boom',
    });
    renderButton('es', 7);

    const button = await screen.findByRole('button', { name: /Me gusta \(7\)/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(button).toHaveTextContent('7');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('manda a login cuando la acción responde unauthorized', async () => {
    mocks.likeQuiz.mockResolvedValue({
      success: false,
      code: 'unauthorized',
      error: 'Sign in to like a quiz.',
    });
    renderButton('en', 7);

    const button = await screen.findByRole('button', { name: /Like \(7\)/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/en/login?redirect=${encodeURIComponent('/en/quiz/mi-quiz')}`
      )
    );
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renderiza enlace a login para anónimos, con redirect a la ficha', async () => {
    mocks.getQuizLikeState.mockResolvedValue({ authenticated: false, liked: false });
    renderButton('es');

    // WCAG 2.5.3: el nombre accesible incluye el texto visible (el contador).
    const link = await screen.findByRole('link', { name: 'Inicia sesión para dar me gusta (7)' });
    expect(link).toHaveAttribute(
      'href',
      `/es/login?redirect=${encodeURIComponent('/es/quiz/mi-quiz')}`
    );
    expect(link).toHaveTextContent('7');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mocks.likeQuiz).not.toHaveBeenCalled();
  });

  it('mantiene el toggle deshabilitado cuando la lectura falla (liked: null)', async () => {
    mocks.getQuizLikeState.mockResolvedValue({ authenticated: true, liked: null });
    renderButton('es');

    const button = await screen.findByRole('button', { name: /Me gusta/ });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(button).toBeDisabled();
    expect(mocks.likeQuiz).not.toHaveBeenCalled();
  });

  it('usa el contador real que devuelve la acción', async () => {
    mocks.likeQuiz.mockResolvedValue({ success: true, liked: true, likesCount: 15 });
    renderButton('es', 7);

    const button = await screen.findByRole('button', { name: /Me gusta \(7\)/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent('15'));
  });

  it('refleja el estado «ya me gusta» leído en el servidor', async () => {
    mocks.getQuizLikeState.mockResolvedValue({ authenticated: true, liked: true });
    renderButton('es', 12);

    const button = await screen.findByRole('button', { name: /Me gusta \(12\)/ });
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
  });
});
