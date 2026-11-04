import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  revalidate: vi.fn(),
  revalidateTag: vi.fn(),
  limitCheck: vi.fn(),
  insert: vi.fn(),
  ip: '192.0.2.1',
  profileResult: { data: { is_admin: true } as { is_admin: boolean } | null },
  quizRow: {
    data: { creator_id: 'user-1', slug: 'quiz-de-prueba', language: 'en' } as {
      creator_id: string;
      slug: string;
      language: string;
      likes_count?: number;
    } | null,
  },
  insertResult: {
    data: { id: 'quiz-1', slug: 'quiz-de-prueba' } as unknown,
    error: null as { code?: string; message: string } | null,
  },
  insertQueue: [] as Array<{ data: unknown; error: { code?: string; message: string } | null }>,
  slugLookup: { data: null as { id: string } | null },
  /** Sondas de existencia de slug: solo debe usarlas el camino publicado. */
  slugProbe: vi.fn(),
  sessionInsertResult: {
    data: { id: 'session-1', share_token: 'tok-1' } as unknown,
    error: null,
  },
  updateResult: { error: null as { message: string } | null },
  deleteResult: { error: null as { message: string } | null },
  rpcResult: { data: true as unknown, error: null as { message: string } | null },
  likeRow: {
    data: null as { quiz_id: string } | null,
    error: null as { message: string } | null,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidate,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': mocks.ip }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: { check: mocks.limitCheck },
  apiLimiter: { check: mocks.limitCheck },
  createRateLimiter: () => ({ check: mocks.limitCheck }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => mocks.profileResult }) }),
        };
      }
      if (table === 'quiz_likes') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: async () => mocks.likeRow }) }),
          }),
        };
      }
      if (table === 'game_sessions') {
        return {
          insert: (payload: unknown) => {
            mocks.insert(payload);
            return { select: () => ({ single: async () => mocks.sessionInsertResult }) };
          },
        };
      }
      if (table !== 'quizzes') throw new Error(`unexpected table ${table}`);
      return {
        select: (columns?: string) => ({
          eq: () => ({
            // La sonda de slugs pide solo 'id'; el resto de lecturas usa quizRow.
            maybeSingle: async () => {
              if (columns === 'id') {
                mocks.slugProbe();
                return mocks.slugLookup;
              }
              return mocks.quizRow;
            },
          }),
        }),
        insert: (payload: unknown) => {
          mocks.insert(payload);
          return {
            select: () => ({
              single: async () =>
                mocks.insertQueue.length ? mocks.insertQueue.shift() : mocks.insertResult,
            }),
          };
        },
        update: () => ({ eq: async () => mocks.updateResult }),
        delete: () => ({ eq: async () => mocks.deleteResult }),
      };
    },
    rpc: async () => mocks.rpcResult,
  }),
}));

vi.mock('@/lib/quiz/quiz-slug', async (importOriginal) => ({
  // `provisionalSlug` queda real: los tests comprueban su forma aleatoria.
  ...(await importOriginal<typeof import('@/lib/quiz/quiz-slug')>()),
  generateUniqueSlug: async (
    _title: string,
    { exists }: { exists: (c: string) => Promise<boolean> }
  ) => {
    for (let i = 0; i < 10; i += 1) {
      const candidate = i === 0 ? 'quiz-de-prueba' : `quiz-de-prueba-${i + 1}`;
      if (!(await exists(candidate))) return candidate;
    }
    return 'quiz-de-prueba-ts';
  },
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({ loadAnswerKeyByQuizId: vi.fn() }));
vi.mock('@/lib/quiz/achievements', () => ({ checkAchievements: async () => [] }));

import {
  createQuiz,
  deleteQuiz,
  getQuizLikeState,
  likeQuiz,
  updateQuiz,
  submitQuizResult,
} from '@/actions/quiz.actions';
import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

const answerKeyQuiz = {
  id: QUIZ_ID,
  slug: 'quiz-de-prueba',
  quiz_type: 'trivia' as const,
  questions: [
    {
      id: 'q1',
      question: '¿Capital de Chile?',
      options: [
        { id: 'a', text: 'Santiago', is_correct: true },
        { id: 'b', text: 'Lima', is_correct: false },
      ],
    },
  ],
  results: null,
};

const createInput = (language: string) => ({
  title: 'Quiz de prueba',
  quiz_type: 'trivia',
  difficulty: 'easy',
  language,
  questions: [
    {
      id: 'q1',
      question: '¿Capital de Chile?',
      options: [
        { id: 'a', text: 'Santiago', is_correct: true },
        { id: 'b', text: 'Lima', is_correct: false },
      ],
    },
  ],
});

beforeEach(() => {
  mocks.userId = 'user-1';
  mocks.insert.mockClear();
  mocks.ip = '192.0.2.1';
  mocks.revalidate.mockClear();
  mocks.revalidateTag.mockClear();
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.profileResult = { data: { is_admin: true } };
  mocks.quizRow = { data: { creator_id: 'user-1', slug: 'quiz-de-prueba', language: 'en' } };
  mocks.insertResult = { data: { id: 'quiz-1', slug: 'quiz-de-prueba' }, error: null };
  mocks.insertQueue = [];
  mocks.slugLookup = { data: null };
  mocks.slugProbe.mockClear();
  mocks.sessionInsertResult = { data: { id: 'session-1', share_token: 'tok-1' }, error: null };
  vi.mocked(loadAnswerKeyByQuizId).mockReset();
  mocks.updateResult = { error: null };
  mocks.deleteResult = { error: null };
  mocks.rpcResult = { data: true, error: null };
  mocks.likeRow = { data: null, error: null };
});

const HUB_PATHS = [
  ['/[locale]/category/[slug]', 'page'],
  ['/[locale]/fandom/[slug]', 'page'],
  ['/[locale]/profile/[username]', 'page'],
];

const expectHubs = () => {
  for (const args of HUB_PATHS) {
    expect(mocks.revalidate).toHaveBeenCalledWith(...args);
  }
};

describe('createQuiz', () => {
  it.each(['no-correct-answer', 'duplicate-question', 'duplicate-option', 'no-results'])(
    'rechaza un quiz no jugable antes de persistir: %s',
    async (invalid) => {
      const input = createInput('es');
      if (invalid === 'no-correct-answer') input.questions[0].options[0].is_correct = false;
      if (invalid === 'duplicate-question') input.questions.push(input.questions[0]);
      if (invalid === 'duplicate-option') input.questions[0].options[1].id = 'a';
      if (invalid === 'no-results') input.quiz_type = 'personality';
      expect(await createQuiz(input)).toMatchObject({ success: false, code: 'invalid_input' });
      expect(mocks.insert).not.toHaveBeenCalled();
    }
  );

  it('rechaza personality cuyas opciones no votan y traduce el error al language del quiz', async () => {
    const input = {
      ...createInput('en'),
      quiz_type: 'personality',
      results: [
        { id: 'r1', title: 'Brave', description: 'You are brave', personality_tag: 'brave' },
        { id: 'r2', title: 'Calm', description: 'You are calm', personality_tag: 'calm' },
      ],
    };
    const result = await createQuiz(input);
    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    if (!result.success) {
      expect(result.error).toContain('existing results');
      expect(result.error).not.toContain('opción');
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('revalida las rutas localizadas del locale del quiz', async () => {
    const result = await createQuiz(createInput('es'));

    expect(result.success).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledTimes(6);
    expect(mocks.revalidate).toHaveBeenCalledWith('/es');
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz');
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz/quiz-de-prueba');
    expectHubs();
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/');
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/quiz');
    // La caché de datos no la purga revalidatePath: los tags van aparte.
    expect(mocks.revalidateTag).toHaveBeenCalledWith('quizzes', { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('quiz:quiz-de-prueba', { expire: 0 });
  });

  it('guarda como draft cuando no hay intent (el estado seguro por defecto)', async () => {
    mocks.profileResult = { data: { is_admin: false } };

    const result = await createQuiz(createInput('es'));

    expect(result.success).toBe(true);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ status: 'draft' });
  });

  it('manda a pending con intent review para un creador normal', async () => {
    mocks.profileResult = { data: { is_admin: false } };

    const result = await createQuiz({ ...createInput('es'), intent: 'review' });

    expect(result.success).toBe(true);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ status: 'pending' });
  });

  it('publica directo con intent review cuando el autor es admin', async () => {
    const result = await createQuiz({ ...createInput('en'), intent: 'review' });

    expect(result.success).toBe(true);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ status: 'published' });
    // El admin ve todo el catálogo: su slug nace limpio, sin sufijo aleatorio.
    expect(mocks.insert.mock.calls[0][0].slug).toBe('quiz-de-prueba');
  });

  it('un borrador no sondea slugs: el resultado no distingue si existe uno privado ajeno', async () => {
    mocks.profileResult = { data: { is_admin: false } };
    const provisional = /^es-quiz-de-prueba--[a-z0-9]{6}$/;

    // Caso A: nada ocupa el slug base. Caso B: existe un quiz invisible para
    // el creador (borrador o pendiente ajeno). La respuesta debe ser la misma
    // forma en ambos: si naciera del slug limpio, el sufijo de colisión sería
    // el oráculo de existencia.
    mocks.slugLookup = { data: null };
    const free = await createQuiz(createInput('es'));
    mocks.slugLookup = { data: { id: 'quiz-ajeno' } };
    const hidden = await createQuiz(createInput('es'));

    expect(free.success).toBe(true);
    expect(hidden.success).toBe(true);
    const freeSlug = mocks.insert.mock.calls[0][0].slug as string;
    const hiddenSlug = mocks.insert.mock.calls[1][0].slug as string;
    expect(freeSlug).toMatch(provisional);
    expect(hiddenSlug).toMatch(provisional);
    expect(freeSlug).not.toBe('quiz-de-prueba');
    expect(hiddenSlug).not.toBe('quiz-de-prueba');
    // Ni siquiera se consulta la existencia: no hay observable que comparar.
    expect(mocks.slugProbe).not.toHaveBeenCalled();
  });

  it('reintenta con otro sufijo aleatorio cuando el INSERT choca (23505)', async () => {
    mocks.profileResult = { data: { is_admin: false } };
    mocks.insertQueue = [
      { data: null, error: { code: '23505', message: 'duplicate key value violates unique' } },
    ];

    const result = await createQuiz({ ...createInput('es'), intent: 'review' });

    expect(result.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    const first = mocks.insert.mock.calls[0][0].slug as string;
    const second = mocks.insert.mock.calls[1][0].slug as string;
    // Ambos provisionales: el reintento no revela ni el número de colisiones.
    expect(first).toMatch(/^es-quiz-de-prueba--[a-z0-9]{6}$/);
    expect(second).toMatch(/^es-quiz-de-prueba--[a-z0-9]{6}$/);
    expect(second).not.toBe(first);
  });

  it('nunca devuelve el mensaje crudo de Postgres al formulario', async () => {
    mocks.profileResult = { data: { is_admin: false } };
    mocks.insertResult = {
      data: null,
      error: { code: '23503', message: 'relation "quizzes" does not exist' },
    };

    const result = await createQuiz(createInput('es'));

    expect(result).toMatchObject({ success: false, code: 'unexpected' });
    if (!result.success) {
      expect(result.error).not.toContain('relation');
      expect(result.error).toBe('Something went wrong. Please try again.');
    }
  });

  it('localiza los errores del schema según el language del quiz', async () => {
    mocks.profileResult = { data: { is_admin: false } };
    const tooShort = { ...createInput('es'), title: 'AB' };

    const result = await createQuiz(tooShort);

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    if (!result.success) {
      expect(result.error).toContain('title: debe tener al menos 5 caracteres');
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('revalida ambos locales cuando el language no es en/es', async () => {
    const result = await createQuiz(createInput('pt'));

    expect(result.success).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledTimes(9);
    for (const locale of ['en', 'es']) {
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz/quiz-de-prueba`);
    }
    expectHubs();
  });
});

describe('submitQuizResult puntos', () => {
  const perfectAnswers = [{ question_id: 'q1', selected_option_id: 'a' }];

  beforeEach(() => {
    vi.mocked(loadAnswerKeyByQuizId).mockResolvedValue(answerKeyQuiz);
  });

  it('devuelve 0 puntos a una partida anónima aunque sea perfecta', async () => {
    // El trigger award_quiz_points no corre sin player_id: la respuesta debe
    // decir lo mismo que la base de datos.
    mocks.userId = null;

    const result = await submitQuizResult(QUIZ_ID, perfectAnswers);

    expect(result).toMatchObject({ success: true, points_earned: 0 });
  });

  it('devuelve 10 puntos a una partida no perfecta de usuario registrado', async () => {
    const result = await submitQuizResult(QUIZ_ID, [
      { question_id: 'q1', selected_option_id: 'b' },
    ]);

    expect(result).toMatchObject({ success: true, points_earned: 10 });
  });

  it('devuelve 35 puntos a una partida perfecta de usuario registrado', async () => {
    const result = await submitQuizResult(QUIZ_ID, perfectAnswers);

    expect(result).toMatchObject({ success: true, points_earned: 35 });
  });
});

describe('submitQuizResult rate limiting', () => {
  it('separa visitantes anónimos por IP y conserva el límite por usuario autenticado', async () => {
    mocks.userId = null;
    await submitQuizResult(QUIZ_ID, []);
    expect(mocks.limitCheck).toHaveBeenLastCalledWith('anonymous:192.0.2.1');
    mocks.ip = '192.0.2.2';
    await submitQuizResult(QUIZ_ID, []);
    expect(mocks.limitCheck).toHaveBeenLastCalledWith('anonymous:192.0.2.2');
    mocks.userId = 'user-1';
    await submitQuizResult(QUIZ_ID, []);
    expect(mocks.limitCheck).toHaveBeenLastCalledWith('user-1');
  });
});

describe('updateQuiz', () => {
  it('revalida el locale original y el nuevo cuando cambia el language', async () => {
    const result = await updateQuiz(QUIZ_ID, { language: 'es' });

    expect(result.success).toBe(true);
    // 3 paths × 2 locales + 3 hub patterns × 2 calls (los hubs se repiten, es idempotente)
    expect(mocks.revalidate).toHaveBeenCalledTimes(12);
    for (const locale of ['en', 'es']) {
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz/quiz-de-prueba`);
    }
    expectHubs();
  });
});

describe('deleteQuiz', () => {
  it('revalida home, explore y detalle del locale del quiz', async () => {
    const result = await deleteQuiz(QUIZ_ID);

    expect(result.success).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledTimes(6);
    expect(mocks.revalidate).toHaveBeenCalledWith('/en');
    expect(mocks.revalidate).toHaveBeenCalledWith('/en/quiz');
    expect(mocks.revalidate).toHaveBeenCalledWith('/en/quiz/quiz-de-prueba');
    expectHubs();
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/');
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/quiz');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('quizzes', { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('quiz:quiz-de-prueba', { expire: 0 });
  });
});

describe('likeQuiz', () => {
  it('revalida detalle y explorar localizados, por slug y no por id', async () => {
    mocks.quizRow = {
      data: { creator_id: 'otro', slug: 'quiz-de-prueba', language: 'es', likes_count: 42 },
    };

    const result = await likeQuiz(QUIZ_ID);

    expect(result).toEqual({ success: true, liked: true, likesCount: 42 });
    expect(mocks.revalidate).toHaveBeenCalledTimes(2);
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz');
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz/quiz-de-prueba');
    expect(mocks.revalidate).not.toHaveBeenCalledWith(`/quiz/${QUIZ_ID}`);
    // Solo la ficha de este quiz: un like no puede tirar el catálogo entero.
    expect(mocks.revalidateTag).toHaveBeenCalledWith('quiz:quiz-de-prueba', 'max');
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith('quizzes', expect.anything());
  });

  it('no revalida si el quiz no existe', async () => {
    mocks.quizRow = { data: null };

    const result = await likeQuiz(QUIZ_ID);

    expect(result.success).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

describe('getQuizLikeState', () => {
  it('devuelve anonymous sin sesión y no consulta quiz_likes', async () => {
    mocks.userId = null;

    expect(await getQuizLikeState(QUIZ_ID)).toEqual({
      authenticated: false,
      liked: false,
    });
  });

  it('devuelve liked: true cuando el usuario tiene fila en quiz_likes', async () => {
    mocks.likeRow = { data: { quiz_id: QUIZ_ID }, error: null };

    expect(await getQuizLikeState(QUIZ_ID)).toEqual({ authenticated: true, liked: true });
  });

  it('devuelve liked: false cuando el usuario no ha dado like', async () => {
    expect(await getQuizLikeState(QUIZ_ID)).toEqual({ authenticated: true, liked: false });
  });

  it('devuelve liked: null cuando la lectura falla', async () => {
    mocks.likeRow = { data: null, error: { message: 'fallo temporal' } };

    expect(await getQuizLikeState(QUIZ_ID)).toEqual({ authenticated: true, liked: null });
  });

  it('devuelve anonymous para ids que no son uuid', async () => {
    expect(await getQuizLikeState('launch-no-existe')).toEqual({
      authenticated: false,
      liked: false,
    });
  });
});
