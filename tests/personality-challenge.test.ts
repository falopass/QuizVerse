/**
 * `getPersonalityChallengeForQuiz`: el reto de un test de personalidad trae
 * los tags del retador derivados de sus respuestas, con la misma regla de
 * siempre — un token de otro quiz no resuelve nada.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  rpcResult: { data: null as unknown, error: null as { code?: string; message?: string } | null },
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => client()),
}));

function client() {
  mocks.rpc.mockImplementation(() => ({ maybeSingle: async () => mocks.rpcResult }));
  return { rpc: mocks.rpc } as unknown as Parameters<typeof fetchSessionByShareToken>[0];
}

import { getPersonalityChallengeForQuiz } from '@/lib/data/challenge';
import type { fetchSessionByShareToken } from '@/lib/data/game-session';
import type { Question } from '@/types/quiz';

const questions: Question[] = [
  {
    id: 'q1',
    question: 'Elige',
    options: [
      { id: 'q1a', text: 'A', personality_tags: ['hero'] },
      { id: 'q1b', text: 'B', personality_tags: ['rival'] },
    ],
  },
  {
    id: 'q2',
    question: 'Elige otra',
    options: [
      { id: 'q2a', text: 'A', personality_tags: ['rival'] },
      { id: 'q2b', text: 'B', personality_tags: ['hero'] },
    ],
  },
];

const quiz = { id: 'quiz-1', questions };

const sessionRow = {
  id: 's-1',
  quiz_id: 'quiz-1',
  score: 2,
  max_score: 2,
  percentage: 100,
  result_id: 'r-rival',
  result_title: 'Vegeta',
  time_taken_seconds: 42,
  answers: [
    { question_id: 'q1', selected_option_id: 'q1b', is_correct: true, time_ms: 900 },
    { question_id: 'q2', selected_option_id: 'q2a', is_correct: true, time_ms: 800 },
  ],
  share_token: 'tok',
  was_shared: false,
  completed_at: '2026-01-01T00:00:00Z',
  attempt_id: null,
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.rpcResult = { data: null, error: null };
});

describe('getPersonalityChallengeForQuiz', () => {
  it('resuelve marcador, resultado y tags del retador', async () => {
    mocks.rpcResult = { data: sessionRow, error: null };

    const challenge = await getPersonalityChallengeForQuiz('tok', quiz);

    expect(challenge).toEqual({
      token: 'tok',
      score: 2,
      maxScore: 2,
      resultTitle: 'Vegeta',
      resultId: 'r-rival',
      tags: ['rival', 'rival'],
    });
  });

  it('rechaza un token de otro quiz', async () => {
    mocks.rpcResult = { data: sessionRow, error: null };

    expect(await getPersonalityChallengeForQuiz('tok', { ...quiz, id: 'otro-quiz' })).toBeNull();
  });

  it('devuelve null sin token o sin sesión', async () => {
    expect(await getPersonalityChallengeForQuiz('', quiz)).toBeNull();
    expect(await getPersonalityChallengeForQuiz('tok', quiz)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('una sesión sin respuestas resuelve con tags vacíos', async () => {
    mocks.rpcResult = { data: { ...sessionRow, answers: null }, error: null };

    const challenge = await getPersonalityChallengeForQuiz('tok', quiz);

    expect(challenge?.tags).toEqual([]);
  });
});
