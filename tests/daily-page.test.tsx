/**
 * `/{locale}/daily`: la página del reto diario.
 *
 * Contrato: el quiz llega al jugador saneado por `toClientQuiz` (ningún
 * `is_correct` cruza la frontera servidor → cliente), las preguntas son solo
 * las del reto y el estado vacío aparece cuando no hay trivia publicada.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  challenge: null as unknown,
  playerProps: null as unknown,
}));

vi.mock('@/lib/data/daily-quiz', () => ({
  getDailyChallenge: async () => mocks.challenge,
}));

vi.mock('@/components/daily/daily-player', () => ({
  DailyPlayer: (props: unknown) => {
    mocks.playerProps = props;
    return <div data-testid="daily-player" />;
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import LocalizedDailyPage, { generateMetadata } from '@/app/[locale]/daily/page';
import type { Quiz } from '@/types/quiz';

const quizWithKey: Quiz = {
  id: '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0',
  slug: 'trivia-del-dia',
  title: 'La trivia del día',
  description: 'Cinco preguntas',
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'medium',
  language: 'es',
  questions: [
    {
      id: 'q1',
      question: 'P1',
      options: [
        { id: 'a', text: 'A', is_correct: true },
        { id: 'b', text: 'B', is_correct: false },
      ],
    },
    {
      id: 'q2',
      question: 'P2',
      options: [
        { id: 'a', text: 'A', is_correct: false },
        { id: 'b', text: 'B', is_correct: true },
      ],
    },
    {
      id: 'q3',
      question: 'P3',
      options: [
        { id: 'a', text: 'A', is_correct: true },
        { id: 'b', text: 'B', is_correct: false },
      ],
    },
    {
      id: 'q4',
      question: 'P4',
      options: [
        { id: 'a', text: 'A', is_correct: false },
        { id: 'b', text: 'B', is_correct: true },
      ],
    },
    {
      id: 'q5',
      question: 'P5',
      options: [
        { id: 'a', text: 'A', is_correct: true },
        { id: 'b', text: 'B', is_correct: false },
      ],
    },
  ],
  results: null,
  tags: [],
  estimated_minutes: 2,
  plays_count: 0,
  shares_count: 0,
  avg_score: null,
  likes_count: 0,
  status: 'published',
  is_featured: false,
  is_ai_generated: false,
  published_at: null,
  updated_at: null,
  created_at: '2026-01-01',
  category: null,
  creator: null,
};

const renderPage = async (locale: string) =>
  render((await LocalizedDailyPage({ params: Promise.resolve({ locale }) })) as ReactNode);

beforeEach(() => {
  mocks.playerProps = null;
  mocks.challenge = {
    quiz: quizWithKey,
    questions: quizWithKey.questions,
    challengeNumber: 6,
    dayKey: '2026-11-10',
  };
});

describe('GET /{locale}/daily (página)', () => {
  it('manda el reto al jugador sin la clave de respuestas', async () => {
    await renderPage('es');
    const props = mocks.playerProps as {
      quiz: Quiz;
      locale: string;
      challengeNumber: number;
      dayKey: string;
    };
    expect(props.challengeNumber).toBe(6);
    expect(props.dayKey).toBe('2026-11-10');
    expect(props.quiz.questions).toHaveLength(5);
    for (const question of props.quiz.questions) {
      for (const option of question.options) {
        expect('is_correct' in option).toBe(false);
      }
    }
  });

  it('muestra el estado vacío cuando no hay reto', async () => {
    mocks.challenge = null;
    await renderPage('en');
    expect(screen.queryByTestId('daily-player')).toBeNull();
    expect(screen.getByText('No challenge today.')).toBeTruthy();
  });

  it('con locale inválido responde 404', async () => {
    await expect(renderPage('xx')).rejects.toThrow('notFound');
  });
});

describe('generateMetadata de /{locale}/daily', () => {
  it('es indexable, con canonical propio y alternates en los dos idiomas', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'es' }) });
    expect(metadata.robots).not.toMatchObject({ index: false });
    expect(metadata.alternates?.canonical).toContain('/es/daily');
    expect(metadata.alternates?.languages?.en).toContain('/en/daily');
  });
});
