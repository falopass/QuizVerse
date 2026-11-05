/**
 * Quien llega por el enlace de un grupo (`?g=`) recibe el grupo cuando termina
 * la partida: la pantalla de resultado ya estaba montada sin él y debe mostrar
 * el ranking igual (antes quedaba congelado en el useState inicial).
 */

import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('@/actions/quiz.actions', () => ({
  incrementShares: vi.fn(async () => ({ success: true })),
  markSessionShared: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/components/quiz/group-leaderboard', () => ({
  GroupLeaderboard: ({
    groupToken,
    creatorNickname,
  }: {
    groupToken: string;
    creatorNickname: string;
  }) => (
    <div data-testid="group-leaderboard">
      {creatorNickname}:{groupToken}
    </div>
  ),
}));

import { ResultScreen } from '@/components/quiz/result-screen';
import type { QuizGroupInfo } from '@/lib/quiz/group';
import type { Quiz } from '@/types/quiz';

const TOKEN = 'aaaa1111bbbb2222';

const quiz: Quiz = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  slug: 'space-trivia',
  title: 'Space Trivia',
  description: 'A trivia quiz about space.',
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'medium',
  language: 'es',
  questions: [],
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
  published_at: '2026-05-21T00:00:00.000Z',
  updated_at: '2026-05-21T00:00:00.000Z',
  created_at: '2026-05-21T00:00:00.000Z',
};

const group: QuizGroupInfo = {
  id: 'g1',
  quizId: quiz.id,
  token: 'fe7c19005172ba0e3b11',
  creatorNickname: 'Diego',
  playerCount: 1,
  createdAt: '2026-11-05T00:00:00.000Z',
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true })),
  });
});

function props(extra: Partial<React.ComponentProps<typeof ResultScreen>> = {}) {
  return {
    locale: 'es' as const,
    quiz,
    score: 2,
    maxScore: 8,
    answers: [],
    shareUrl: `https://quizverse.org/es/quiz/space-trivia/result?s=${TOKEN}`,
    shareToken: TOKEN,
    onPlayAgain: () => {},
    ...extra,
  };
}

describe('ResultScreen · grupo del enlace de invitación', () => {
  it('muestra el ranking cuando el grupo llega después del primer render', () => {
    const { rerender } = render(<ResultScreen {...props({ group: null })} />);
    expect(screen.queryByTestId('group-leaderboard')).toBeNull();

    rerender(<ResultScreen {...props({ group, canJoinGroup: true })} />);

    expect(screen.getByTestId('group-leaderboard')).toHaveTextContent(`Diego:${group.token}`);
  });

  it('sin grupo no monta el ranking', () => {
    render(<ResultScreen {...props()} />);
    expect(screen.queryByTestId('group-leaderboard')).toBeNull();
  });
});
