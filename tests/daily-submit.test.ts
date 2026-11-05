/**
 * `submitDailyResult`: la calificación del reto diario es del servidor.
 *
 * Contrato: solo se aceptan el reto de hoy o el de ayer (carrera de
 * medianoche), el conjunto de preguntas lo recalcula el servidor y no el
 * cliente, y con el anti-trampa activo hace falta un attempt válido — sin él
 * esto sería un oráculo de respuestas.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  limitCheck: vi.fn(),
  verifyAttempt: vi.fn(),
  attemptsAvailable: false,
  challenge: null as {
    quiz: { id: string };
    questions: Array<{ id: string }>;
    challengeNumber: number;
    dayKey: string;
  } | null,
  answerKey: null as {
    id: string;
    quiz_type: string;
    results: null;
    questions: Array<{
      id: string;
      question: string;
      options: Array<{ id: string; text: string; is_correct: boolean }>;
    }>;
  } | null,
}));

vi.mock('next/headers', () => ({ headers: async () => new Map<string, string>() }));

vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: { check: mocks.limitCheck },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
  }),
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({
  loadAnswerKeyByQuizId: async () => mocks.answerKey,
}));

vi.mock('@/lib/data/daily-quiz', () => ({
  getDailyChallenge: async () => mocks.challenge,
}));

vi.mock('@/lib/quiz/attempt', () => ({
  attemptsAvailable: () => mocks.attemptsAvailable,
  verifyQuizAttempt: mocks.verifyAttempt,
  warnAttemptsInactive: vi.fn(),
}));

import { submitDailyResult } from '@/actions/daily.actions';
import { dayKey, dayKeyAdd } from '@/lib/content/daily-pick';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
const TODAY = dayKey(new Date());
const YESTERDAY = dayKeyAdd(TODAY, -1);

const keyQuestions = [
  {
    id: 'q1',
    question: 'P1',
    options: [
      { id: 'a', text: 'ok', is_correct: true },
      { id: 'b', text: 'no', is_correct: false },
    ],
  },
  {
    id: 'q2',
    question: 'P2',
    options: [
      { id: 'a', text: 'no', is_correct: false },
      { id: 'b', text: 'ok', is_correct: true },
    ],
  },
  {
    id: 'q3',
    question: 'P3',
    options: [
      { id: 'a', text: 'ok', is_correct: true },
      { id: 'b', text: 'no', is_correct: false },
    ],
  },
  {
    id: 'q4',
    question: 'P4',
    options: [
      { id: 'a', text: 'no', is_correct: false },
      { id: 'b', text: 'ok', is_correct: true },
    ],
  },
  {
    id: 'q5',
    question: 'P5',
    options: [
      { id: 'a', text: 'ok', is_correct: true },
      { id: 'b', text: 'no', is_correct: false },
    ],
  },
  {
    id: 'q6',
    question: 'P6',
    options: [
      { id: 'a', text: 'no', is_correct: false },
      { id: 'b', text: 'ok', is_correct: true },
    ],
  },
];

// El reto del día usa las preguntas pares del quiz completo.
const DAILY_IDS = ['q2', 'q4', 'q5', 'q1', 'q6'];

const submit = (overrides: Record<string, unknown> = {}) =>
  submitDailyResult({
    quizId: QUIZ_ID,
    locale: 'es',
    dayKey: TODAY,
    answers: DAILY_IDS.map((question_id) => ({ question_id, selected_option_id: 'a' })),
    ...overrides,
  });

beforeEach(() => {
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.verifyAttempt.mockReset().mockResolvedValue({ ok: true, attempt: { attemptId: 'a1' } });
  mocks.attemptsAvailable = false;
  mocks.challenge = {
    quiz: { id: QUIZ_ID },
    questions: DAILY_IDS.map((id) => ({ id })),
    challengeNumber: 7,
    dayKey: TODAY,
  };
  mocks.answerKey = { id: QUIZ_ID, quiz_type: 'trivia', results: null, questions: keyQuestions };
});

describe('submitDailyResult', () => {
  it('califica contra la clave del servidor y devuelve la grilla en orden', async () => {
    // En el reto, 'a' es correcta solo en q3... pero q3 no es del reto. En las
    // del reto: q1 'a' ✓, q2 'a' ✗, q4 'a' ✗, q5 'a' ✓, q6 'a' ✗.
    const result = await submit();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.marks).toEqual([false, false, true, true, false]);
      expect(result.score).toBe(2);
      expect(result.maxScore).toBe(5);
    }
  });

  it('ignora respuestas fuera del reto y cuenta las ausentes como fallo', async () => {
    const result = await submit({
      answers: [
        { question_id: 'q3', selected_option_id: 'a' }, // no es del reto
        { question_id: 'q2', selected_option_id: 'b' }, // correcta
        { question_id: 'q2', selected_option_id: 'a' }, // duplicada: gana la primera
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.marks).toEqual([true, false, false, false, false]);
      expect(result.score).toBe(1);
    }
  });

  it('rechaza un quizId que no es el reto del día', async () => {
    const result = await submit({ quizId: '7a1b3c9d-2e4f-4a5b-8c6d-1e2f3a4b5c6d' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
  });

  it('acepta el reto de ayer (carrera de medianoche) y rechaza días viejos', async () => {
    mocks.challenge = { ...mocks.challenge!, dayKey: YESTERDAY };
    const yesterday = await submit({ dayKey: YESTERDAY });
    expect(yesterday.success).toBe(true);

    const stale = await submit({ dayKey: '2020-01-01' });
    expect(stale.success).toBe(false);
  });

  it('con anti-trampa activo exige un attempt válido', async () => {
    mocks.attemptsAvailable = true;
    const missing = await submit();
    expect(missing.success).toBe(false);

    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'bad_signature' });
    const invalid = await submit({ attempt: 'fake' });
    expect(invalid.success).toBe(false);

    mocks.verifyAttempt.mockResolvedValue({ ok: true, attempt: { attemptId: 'a1' } });
    const valid = await submit({ attempt: 'signed-token' });
    expect(valid.success).toBe(true);
  });

  it('en modo degradado califica sin attempt', async () => {
    mocks.attemptsAvailable = false;
    const result = await submit();
    expect(result.success).toBe(true);
  });

  it('respeta el rate limit', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });
    const result = await submit();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('rate_limited');
  });
});
