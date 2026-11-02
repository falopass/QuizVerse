/**
 * Tests for the single door to the answer key.
 *
 * Post-015 the key lives in `quiz_answer_keys` (service_role only) while
 * `quizzes.questions` stays sanitized. These tests pin the whole state matrix:
 * the key table when it yields a row, `questions` as fallback while the
 * migration is not applied, and the loud failure when a trivia quiz's key is
 * unreachable (migration applied without SUPABASE_SERVICE_ROLE_KEY).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  serviceClient: null as { from: (table: string) => unknown } | null,
  quizResult: { data: null as unknown, error: null as unknown },
  keyResult: { data: null as unknown, error: null as unknown },
  fromSpy: vi.fn(),
  selectSpy: vi.fn(),
  eqSpy: vi.fn(),
}));

function makeFrom() {
  return (table: string) => {
    mocks.fromSpy(table);
    return {
      select: (columns: string) => {
        mocks.selectSpy(table, columns);
        const node = {
          eq: (column: string, value: unknown) => {
            mocks.eqSpy(column, value);
            return node;
          },
          maybeSingle: async () => (table === 'quizzes' ? mocks.quizResult : mocks.keyResult),
        };
        return node;
      },
    };
  };
}

const sharedFrom = makeFrom();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: sharedFrom }),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mocks.serviceClient,
}));

import { loadAnswerKeyByQuizId, loadAnswerKeyBySlug } from '@/lib/quiz/quiz-repository';

const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

const QUIZ_ID = '123e4567-e89b-12d3-a456-426614174000';

// Raw jsonb as stored pre-015 / in quiz_answer_keys: `is_correct` inside every
// option, `explanation` on the question.
const RAW_QUESTIONS = [
  {
    id: 'q1',
    question: 'What is the name of the substance that gives superheroes their powers?',
    options: [
      { id: 'a', text: 'Compound V', is_correct: true },
      { id: 'b', text: 'Serum X', is_correct: false },
    ],
    explanation: 'Compound V is the signature chemical developed by Vought.',
    time_limit_seconds: 30,
  },
  {
    id: 'q2',
    question: 'Who leads The Seven?',
    options: [
      { id: 'a', text: 'Homelander', is_correct: true },
      { id: 'b', text: 'Black Noir', is_correct: false },
    ],
    explanation: null,
    time_limit_seconds: 30,
  },
];

// What the public `questions` column holds once the migration is applied.
const SANITIZED_QUESTIONS = [
  {
    id: 'q1',
    question: 'What is the name of the substance that gives superheroes their powers?',
    options: [
      { id: 'a', text: 'Compound V' },
      { id: 'b', text: 'Serum X' },
    ],
    time_limit_seconds: 30,
  },
];

const PERSONALITY_QUESTIONS = [
  {
    id: 'q1',
    question: 'Pick a city.',
    options: [
      { id: 'a', text: 'The Loud One', personality_tags: ['bold'] },
      { id: 'b', text: 'The Quiet One', personality_tags: ['calm'] },
    ],
  },
];

const PUBLISHED_ROW = {
  id: QUIZ_ID,
  slug: 'en-the-boys-trivia',
  quiz_type: 'trivia',
  questions: RAW_QUESTIONS,
  results: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.serviceClient = null;
  mocks.quizResult = { data: PUBLISHED_ROW, error: null };
  mocks.keyResult = { data: { questions: RAW_QUESTIONS }, error: null };
});

describe('loadAnswerKeyByQuizId', () => {
  it('devuelve la clave desde quiz_answer_keys cuando hay fila (post-015)', async () => {
    mocks.serviceClient = { from: sharedFrom };
    mocks.quizResult = { data: { ...PUBLISHED_ROW, questions: SANITIZED_QUESTIONS }, error: null };

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz?.questions[0].options[0]).toMatchObject({ id: 'a', is_correct: true });
    expect(mocks.fromSpy).toHaveBeenCalledWith('quiz_answer_keys');
  });

  it('cae a la columna questions cuando la tabla de claves aún no existe (pre-015)', async () => {
    mocks.keyResult = { data: null, error: { code: 'PGRST205', message: 'not in schema cache' } };

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz?.questions[0].options[0]).toMatchObject({ is_correct: true });
  });

  it('sin SUPABASE_SERVICE_ROLE_KEY lee con el cliente SSR normal', async () => {
    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz?.quiz_type).toBe('trivia');
    expect(quiz?.questions[0].options[0].is_correct).toBe(true);
  });

  it('consulta solo quizzes publicados: un borrador no se juega ni por id', async () => {
    await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(mocks.fromSpy).toHaveBeenCalledWith('quizzes');
    expect(mocks.selectSpy).toHaveBeenCalledWith(
      'quizzes',
      'id, slug, quiz_type, questions, results'
    );
    expect(mocks.eqSpy).toHaveBeenCalledWith('id', QUIZ_ID);
    expect(mocks.eqSpy).toHaveBeenCalledWith('status', 'published');
  });

  it('devuelve null si el quiz es borrador o no existe', async () => {
    mocks.quizResult = { data: null, error: null };

    await expect(loadAnswerKeyByQuizId(QUIZ_ID)).resolves.toBeNull();
  });

  it('devuelve null ante un error de supabase en vez de lanzar', async () => {
    mocks.quizResult = { data: null, error: { message: 'connection failed', code: 'XX000' } };

    await expect(loadAnswerKeyByQuizId(QUIZ_ID)).resolves.toBeNull();
  });

  it('trivia con clave inaccesible: null + error claro en logs, nunca ceros silenciosos', async () => {
    // Estado (d): migración aplicada sin service role — la columna pública ya
    // no tiene is_correct y quiz_answer_keys no se puede leer.
    mocks.quizResult = { data: { ...PUBLISHED_ROW, questions: SANITIZED_QUESTIONS }, error: null };
    mocks.keyResult = { data: null, error: null };

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY'));
  });

  it('clave parcial (una pregunta saneada sin fila de clave) también grita', async () => {
    // Mezcla q1 con clave + q2 sin ella: puntuar eso daría aciertos falsos y
    // fallos falsos; se rechaza igual que la columna saneada completa.
    mocks.quizResult = {
      data: { ...PUBLISHED_ROW, questions: [RAW_QUESTIONS[0], SANITIZED_QUESTIONS[0]] },
      error: null,
    };
    mocks.keyResult = { data: null, error: null };

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY'));
  });

  it('personality sin fila de clave sigue funcionando: su contenido es público', async () => {
    mocks.quizResult = {
      data: {
        ...PUBLISHED_ROW,
        quiz_type: 'personality',
        questions: PERSONALITY_QUESTIONS,
        results: [
          {
            id: 'r1',
            title: 'The Reporter',
            description: 'You expose the rot.',
            personality_tag: 'reporter',
            background_theme: 'fire',
          },
        ],
      },
      error: null,
    };
    mocks.keyResult = { data: null, error: null };

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz?.questions[0].options[0].personality_tags).toEqual(['bold']);
    expect(quiz?.results?.[0]).toMatchObject({ id: 'r1', personality_tag: 'reporter' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('con fila de clave vacía en personality tampoco grita', async () => {
    // Una personality quiz nunca escribe clave: la fila puede no existir y el
    // fallback a questions es el camino normal, no un error.
    mocks.quizResult = {
      data: { ...PUBLISHED_ROW, quiz_type: 'personality', questions: PERSONALITY_QUESTIONS },
      error: null,
    };
    mocks.keyResult = { data: null, error: null };

    await expect(loadAnswerKeyByQuizId(QUIZ_ID)).resolves.not.toBeNull();
  });
});

describe('loadAnswerKeyBySlug', () => {
  it('filtra por slug, status publicado e idioma', async () => {
    await loadAnswerKeyBySlug('en-the-boys-trivia', 'en');

    expect(mocks.eqSpy).toHaveBeenCalledWith('slug', 'en-the-boys-trivia');
    expect(mocks.eqSpy).toHaveBeenCalledWith('status', 'published');
    expect(mocks.eqSpy).toHaveBeenCalledWith('language', 'en');
  });

  it('devuelve la clave para la revisión de /result', async () => {
    const quiz = await loadAnswerKeyBySlug('en-the-boys-trivia', 'en');

    expect(quiz?.questions[0].options[0].is_correct).toBe(true);
    expect(quiz?.questions[0].explanation).toContain('Compound V');
  });

  it('devuelve null si el slug no existe', async () => {
    mocks.quizResult = { data: null, error: null };

    await expect(loadAnswerKeyBySlug('nope', 'en')).resolves.toBeNull();
  });
});
