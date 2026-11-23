import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  userId: 'creator-1' as string | null,
  limitCheck: vi.fn(),
  insertSpy: vi.fn(),
  updateSpy: vi.fn(),
  rpcSpy: vi.fn(),
  serviceSelectSpy: vi.fn(),
  hasServiceClient: true,
  profileResult: { data: { is_admin: false } as { is_admin: boolean } | null },
  quizRow: {
    data: null as Record<string, unknown> | null,
  },
  keyRow: {
    data: null as { questions: unknown } | null,
  },
  rpcResult: {
    data: null as unknown,
    error: null as { code?: string; message: string } | null,
  },
  insertResult: {
    data: { id: 'quiz-new-1', slug: 'es-quiz-manual--abc123' } as unknown,
    error: null as { code?: string; message: string } | null,
  },
  updateResult: { error: null as { message: string } | null },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: { check: mocks.limitCheck },
  apiLimiter: { check: mocks.limitCheck },
  createRateLimiter: () => ({ check: mocks.limitCheck }),
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () =>
    mocks.hasServiceClient
      ? {
          from: (table: string) => {
            if (table !== 'quiz_answer_keys') throw new Error(`unexpected service table ${table}`);
            return {
              select: () => ({
                eq: (col: string, val: string) => ({
                  maybeSingle: async () => {
                    mocks.serviceSelectSpy(col, val);
                    return mocks.keyRow;
                  },
                }),
              }),
            };
          },
        }
      : null,
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
      if (table !== 'quizzes') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => mocks.quizRow,
          }),
        }),
        insert: (payload: unknown) => {
          mocks.insertSpy(payload);
          return { select: () => ({ single: async () => mocks.insertResult }) };
        },
        update: (payload: unknown) => {
          mocks.updateSpy(payload);
          return { eq: async () => mocks.updateResult };
        },
      };
    },
    rpc: async (fn: string, args: unknown) => {
      mocks.rpcSpy(fn, args);
      return mocks.rpcResult;
    },
  }),
}));

import { createQuiz, getOwnDraftContent, updateQuiz } from '@/actions/quiz.actions';
import AboutPage from '@/app/[locale]/about/page';
import { QuizEditForm } from '@/components/quiz/quiz-edit-form';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

const validTriviaQuestions = [
  {
    id: 'q1',
    question: '¿Capital de Chile?',
    options: [
      { id: 'a', text: 'Santiago', is_correct: true },
      { id: 'b', text: 'Lima', is_correct: false },
    ],
    explanation: 'Santiago es la capital.',
  },
];

const validTriviaPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Trivia de capitales de América',
  description: 'Demuestra lo que sabes.',
  quiz_type: 'trivia',
  difficulty: 'medium',
  language: 'es',
  questions: validTriviaQuestions,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'creator-1';
  mocks.limitCheck.mockResolvedValue({ allowed: true });
  mocks.hasServiceClient = true;
  mocks.profileResult = { data: { is_admin: false } };
  mocks.quizRow = {
    data: {
      creator_id: 'creator-1',
      slug: 'es-borrador--123456',
      language: 'es',
      status: 'draft',
      title: 'Borrador propio',
      quiz_type: 'trivia',
      difficulty: 'medium',
      questions: [
        {
          id: 'q1',
          question: '¿Capital de Chile?',
          options: [
            { id: 'a', text: 'Santiago' },
            { id: 'b', text: 'Lima' },
          ],
        },
      ],
      results: null,
    },
  };
  mocks.keyRow = { data: { questions: validTriviaQuestions } };
  mocks.rpcResult = { data: validTriviaQuestions, error: null };
  mocks.insertResult = {
    data: { id: 'quiz-new-1', slug: 'es-quiz-manual--abc123' },
    error: null,
  };
  mocks.updateResult = { error: null };
});

describe('createQuiz (A-02: columna generada question_count y locales vigentes)', () => {
  it('nunca envía question_count en el INSERT de borrador manual, borrador IA ni revisión', async () => {
    const manualDraft = await createQuiz({ ...validTriviaPayload(), intent: 'draft' });
    const aiDraft = await createQuiz({
      ...validTriviaPayload({ is_ai_generated: true }),
      intent: 'draft',
    });
    const review = await createQuiz({ ...validTriviaPayload(), intent: 'review' });

    expect(manualDraft.success).toBe(true);
    expect(aiDraft.success).toBe(true);
    expect(review.success).toBe(true);
    expect(mocks.insertSpy).toHaveBeenCalledTimes(3);

    for (const [payload] of mocks.insertSpy.mock.calls) {
      expect(payload).not.toHaveProperty('question_count');
    }
    expect(mocks.insertSpy.mock.calls[0][0]).toMatchObject({
      status: 'draft',
      is_ai_generated: false,
    });
    expect(mocks.insertSpy.mock.calls[1][0]).toMatchObject({
      status: 'draft',
      is_ai_generated: true,
    });
    expect(mocks.insertSpy.mock.calls[2][0]).toMatchObject({
      status: 'pending',
    });
  });

  it('rechaza locales fuera del catálogo vigente antes de tocar la base', async () => {
    const result = await createQuiz(validTriviaPayload({ language: 'pt' }));

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });
});

describe('edición de preguntas en borradores propios (030 / compatibilidad dual)', () => {
  it('getOwnDraftContent devuelve la clave solo en borradores propios vía service role', async () => {
    const result = await getOwnDraftContent(QUIZ_ID);

    expect(result).toEqual({
      success: true,
      editable: true,
      status: 'draft',
      questions: validTriviaQuestions,
      results: null,
    });
    expect(mocks.serviceSelectSpy).toHaveBeenCalledWith('quiz_id', QUIZ_ID);
  });

  it('getOwnDraftContent usa RPC get_own_draft_questions (030) cuando falta service role', async () => {
    mocks.hasServiceClient = false;

    const result = await getOwnDraftContent(QUIZ_ID);

    expect(result).toMatchObject({
      success: true,
      editable: true,
      questions: validTriviaQuestions,
    });
    expect(mocks.rpcSpy).toHaveBeenCalledWith('get_own_draft_questions', { p_quiz_id: QUIZ_ID });
  });

  it('getOwnDraftContent degrada a quizzes.questions si la migración 030 aún no está aplicada', async () => {
    mocks.hasServiceClient = false;
    mocks.rpcResult = {
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.get_own_draft_questions',
      },
    };

    const result = await getOwnDraftContent(QUIZ_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.editable).toBe(true);
      expect(result.questions).toHaveLength(1);
    }
  });

  it.each(['pending', 'published', 'rejected', 'archived'])(
    'getOwnDraftContent nunca entrega preguntas ni claves cuando status es %s',
    async (status) => {
      mocks.quizRow = { data: { ...mocks.quizRow.data, status } };

      const result = await getOwnDraftContent(QUIZ_ID);

      expect(result).toEqual({
        success: true,
        editable: false,
        status,
        questions: [],
        results: null,
      });
      expect(mocks.serviceSelectSpy).not.toHaveBeenCalled();
      expect(mocks.rpcSpy).not.toHaveBeenCalled();
    }
  );

  it('updateQuiz permite actualizar preguntas válidas de un borrador propio sin mandar question_count', async () => {
    const updatedQuestions = [
      ...validTriviaQuestions,
      {
        id: 'q2',
        question: '¿Capital de Perú?',
        options: [
          { id: 'a', text: 'Lima', is_correct: true },
          { id: 'b', text: 'Quito', is_correct: false },
        ],
        explanation: 'Lima es la capital.',
      },
    ];

    const result = await updateQuiz(QUIZ_ID, { questions: updatedQuestions });

    expect(result).toEqual({ success: true });
    expect(mocks.updateSpy).toHaveBeenCalledTimes(1);
    const payload = mocks.updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toHaveProperty('questions');
    expect(payload).not.toHaveProperty('question_count');
  });

  it('updateQuiz rechaza preguntas inválidas en borrador antes de persistir', async () => {
    const brokenQuestions = [
      {
        id: 'q1',
        question: '¿Sin respuesta correcta?',
        options: [
          { id: 'a', text: 'No', is_correct: false },
          { id: 'b', text: 'Tampoco', is_correct: false },
        ],
      },
    ];

    const result = await updateQuiz(QUIZ_ID, { questions: brokenQuestions });

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it.each(['pending', 'published', 'rejected', 'archived'])(
    'updateQuiz rechaza editar preguntas cuando status es %s',
    async (status) => {
      mocks.quizRow = { data: { ...mocks.quizRow.data, status } };

      const result = await updateQuiz(QUIZ_ID, { questions: validTriviaQuestions });

      expect(result).toMatchObject({ success: false, code: 'conflict' });
      expect(mocks.updateSpy).not.toHaveBeenCalled();
    }
  );
});

describe('AboutPage (C-04: retirar encuestas/poll)', () => {
  it('anuncia únicamente trivia y personalidad en español e inglés', async () => {
    const { unmount } = render(await AboutPage({ params: Promise.resolve({ locale: 'es' }) }));
    expect(screen.getByText(/formatos de trivia y personalidad/i)).toBeInTheDocument();
    expect(screen.queryByText(/encuestas/i)).not.toBeInTheDocument();
    unmount();

    render(await AboutPage({ params: Promise.resolve({ locale: 'en' }) }));
    expect(screen.getByText(/trivia and personality formats/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bpoll\b/i)).not.toBeInTheDocument();
  });
});

describe('QuizEditForm edición de preguntas en borrador', () => {
  const editableQuiz = {
    id: QUIZ_ID,
    title: 'Borrador propio',
    description: 'Descripción de prueba.',
    category_id: null,
    quiz_type: 'trivia' as const,
    difficulty: 'medium' as const,
    language: 'es',
    tags: ['geografia'],
    estimated_minutes: 3,
  };

  it('carga las preguntas del borrador propio, permite editarlas y guarda con validación completa', async () => {
    render(
      React.createElement(QuizEditForm, {
        quiz: editableQuiz,
        categories: [],
        locale: 'es',
      })
    );

    expect(screen.getByText('Qué puedes editar y qué vuelve a moderación')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar preguntas del borrador' }));

    const questionInput = await screen.findByLabelText('Pregunta 1');
    expect(questionInput).toHaveValue('¿Capital de Chile?');

    fireEvent.change(questionInput, { target: { value: '¿Cuál es la capital de Chile?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mocks.updateSpy).toHaveBeenCalledTimes(1));
    const payload = mocks.updateSpy.mock.calls[0][0] as {
      questions: Array<{ question: string }>;
    };
    expect(payload.questions[0].question).toBe('¿Cuál es la capital de Chile?');
    expect(payload).not.toHaveProperty('question_count');
  });

  it('informa por qué no se pueden editar preguntas cuando el quiz está en revisión', async () => {
    mocks.quizRow = { data: { ...mocks.quizRow.data, status: 'pending' } };
    render(
      React.createElement(QuizEditForm, {
        quiz: editableQuiz,
        categories: [],
        locale: 'es',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar preguntas del borrador' }));

    expect(
      await screen.findByText(/Retíralo a borrador desde «Mis quizzes» para editar sus preguntas/i)
    ).toBeInTheDocument();
  });
});
