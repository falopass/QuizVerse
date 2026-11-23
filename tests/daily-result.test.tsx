import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyPlayer } from '@/components/daily/daily-player';
import { DailyResult } from '@/components/daily/daily-result';
import { dayKey } from '@/lib/content/daily-pick';
import type { Quiz } from '@/types/quiz';

vi.mock('@/actions/quiz.actions', () => ({
  startQuizAttempt: vi.fn().mockResolvedValue({ success: false }),
}));
vi.mock('@/actions/daily.actions', () => ({
  submitDailyResult: vi.fn().mockResolvedValue({ success: true, marks: [true], score: 1 }),
}));
vi.mock('@/lib/quiz/reveal-client', () => ({
  requestAnswerVerdict: vi.fn().mockResolvedValue({ isCorrect: true, correctOptionId: 'correct' }),
}));
vi.mock('@/lib/telemetry/client', () => ({ trackEvent: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Reto diario', () => {
  it('espera el bot\u00f3n Terminar con movimiento reducido y enfoca el resultado', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const quiz = {
      id: 'daily-fixture',
      slug: 'daily-fixture',
      title: 'Daily fixture',
      quiz_type: 'trivia',
      questions: [
        { id: 'q1', question: 'One plus one?', options: [{ id: 'correct', text: 'Two' }] },
      ],
    } as Quiz;
    render(<DailyPlayer quiz={quiz} locale="en" challengeNumber={1} dayKey={dayKey(new Date())} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Play today/ }));
    fireEvent.click(screen.getByRole('button', { name: /Two/ }));
    await act(async () => vi.advanceTimersByTimeAsync(5000));

    const finish = screen.getByRole('button', { name: 'Finish' });
    expect(finish).toHaveFocus();
    fireEvent.click(finish);
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Daily fixture' })).toHaveFocus();
  });

  it('muestra el puntaje y ofrece salidas localizadas', async () => {
    render(
      <DailyResult
        locale="es"
        challengeNumber={5}
        quizTitle="Reto"
        score={2}
        total={3}
        marks={[true, false, true]}
        seconds={63}
        streak={2}
      />
    );
    await act(async () => {});
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /M\u00e1s quizzes/ })).toHaveAttribute(
      'href',
      '/es/quiz'
    );
    expect(screen.getByRole('link', { name: /Volver al inicio/ })).toHaveAttribute('href', '/es');
  });
});
