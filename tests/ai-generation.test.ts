import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAIQuizResponse } from '@/lib/quiz/validator';

// Fixtures con la forma exacta que pide el prompt de DeepSeek
// (ver createUserPrompt en src/lib/quiz/generator.ts).

type TriviaOption = { id: string; text: string; is_correct?: boolean };
type TriviaQuestion = {
  id: string;
  question: string;
  options: TriviaOption[];
  explanation: string | null;
};

const triviaQuestion = (id: string, options?: TriviaOption[]): TriviaQuestion => ({
  id,
  question: `Question ${id}?`,
  options: options ?? [
    { id: 'a', text: 'Correct answer', is_correct: true },
    { id: 'b', text: 'Wrong answer B', is_correct: false },
    { id: 'c', text: 'Wrong answer C', is_correct: false },
    { id: 'd', text: 'Wrong answer D', is_correct: false },
  ],
  explanation: 'Because reasons.',
});

const validTrivia = () => ({
  title: 'The Ultimate Space Trivia Quiz',
  description: 'Test your knowledge of the cosmos.',
  questions: [triviaQuestion('q1'), triviaQuestion('q2'), triviaQuestion('q3')],
  tags: ['space', 'science'],
  estimated_minutes: 5,
});

const personalityQuestion = (id: string) => ({
  id,
  question: `Pick one for ${id}.`,
  options: [
    { id: 'a', text: 'Bonfire night', personality_tags: ['fire'] },
    { id: 'b', text: 'Beach day', personality_tags: ['ocean'] },
    { id: 'c', text: 'Forest hike', personality_tags: ['forest'] },
    { id: 'd', text: 'Stargazing', personality_tags: ['stars'] },
  ],
  explanation: null,
});

const validPersonality = () => ({
  title: 'Which Element Matches Your Soul?',
  description: 'Discover your inner element.',
  questions: [personalityQuestion('q1'), personalityQuestion('q2'), personalityQuestion('q3')],
  results: [
    {
      id: 'r1',
      title: 'Fire',
      description: 'Bold and intense.',
      personality_tag: 'fire',
      background_theme: 'fire',
    },
    {
      id: 'r2',
      title: 'Ocean',
      description: 'Calm and deep.',
      personality_tag: 'ocean',
      background_theme: 'ocean',
    },
    {
      id: 'r3',
      title: 'Forest',
      description: 'Grounded and steady.',
      personality_tag: 'forest',
      background_theme: 'forest',
    },
    {
      id: 'r4',
      title: 'Stars',
      description: 'Dreamy and curious.',
      personality_tag: 'stars',
      background_theme: 'stars',
    },
  ],
  tags: ['personality', 'elements'],
  estimated_minutes: 4,
});

describe('validateAIQuizResponse', () => {
  it('acepta una trivia válida y devuelve el objeto parseado sin campos extra', () => {
    const withExtras = {
      ...validTrivia(),
      injected_field: 'should-be-stripped',
      questions: validTrivia().questions.map((q) => ({ ...q, secret_note: 'strip-me' })),
    };
    const result = validateAIQuizResponse(withExtras, 'trivia');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toBeDefined();
    expect(result.data).not.toHaveProperty('injected_field');
    expect(result.data?.questions[0]).not.toHaveProperty('secret_note');
  });

  it('acepta una personality válida con 4 resultados', () => {
    const result = validateAIQuizResponse(validPersonality(), 'personality');
    expect(result.valid).toBe(true);
    expect(result.data?.results).toHaveLength(4);
  });

  it('rechaza trivia con dos respuestas correctas en una pregunta', () => {
    const quiz = validTrivia();
    quiz.questions[1] = triviaQuestion('q2', [
      { id: 'a', text: 'A', is_correct: true },
      { id: 'b', text: 'B', is_correct: true },
      { id: 'c', text: 'C', is_correct: false },
    ]);
    const result = validateAIQuizResponse(quiz, 'trivia');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Pregunta 2'))).toBe(true);
  });

  it('rechaza trivia sin ninguna respuesta correcta', () => {
    const quiz = validTrivia();
    quiz.questions[0] = triviaQuestion('q1', [
      { id: 'a', text: 'A', is_correct: false },
      { id: 'b', text: 'B', is_correct: false },
      { id: 'c', text: 'C', is_correct: false },
    ]);
    const result = validateAIQuizResponse(quiz, 'trivia');
    expect(result.valid).toBe(false);
  });

  it('rechaza ids de preguntas y opciones duplicados', () => {
    const dupQuestions = validTrivia();
    dupQuestions.questions[1] = { ...dupQuestions.questions[1], id: 'q1' };
    expect(validateAIQuizResponse(dupQuestions, 'trivia').valid).toBe(false);

    const dupOptions = validTrivia();
    dupOptions.questions[0].options[1] = { ...dupOptions.questions[0].options[1], id: 'a' };
    expect(validateAIQuizResponse(dupOptions, 'trivia').valid).toBe(false);
  });

  it('rechaza una opción con texto vacío', () => {
    const quiz = validTrivia();
    quiz.questions[0] = triviaQuestion('q1', [
      { id: 'a', text: '', is_correct: true },
      { id: 'b', text: 'B', is_correct: false },
    ]);
    const result = validateAIQuizResponse(quiz, 'trivia');
    expect(result.valid).toBe(false);
  });

  it('rechaza 0 preguntas', () => {
    const result = validateAIQuizResponse({ ...validTrivia(), questions: [] }, 'trivia');
    expect(result.valid).toBe(false);
  });

  it('rechaza personality sin resultados', () => {
    const result = validateAIQuizResponse(
      { ...validPersonality(), results: undefined },
      'personality'
    );
    expect(result.valid).toBe(false);
  });

  it('rechaza personality con menos de 3 resultados', () => {
    const quiz = validPersonality();
    quiz.results = quiz.results.slice(0, 2);
    const result = validateAIQuizResponse(quiz, 'personality');
    expect(result.valid).toBe(false);
  });

  it('rechaza personality con personality_tag null o tags inconsistentes con opciones', () => {
    const nullTag = validPersonality();
    (nullTag.results[0] as { personality_tag: string | null }).personality_tag = null;
    expect(validateAIQuizResponse(nullTag, 'personality').valid).toBe(false);

    const ghostTag = validPersonality();
    ghostTag.questions[0].options[0].personality_tags = ['nonexistent'];
    expect(validateAIQuizResponse(ghostTag, 'personality').valid).toBe(false);
  });

  it('rechaza background_theme fuera del enum', () => {
    const quiz = validPersonality();
    quiz.results[0] = { ...quiz.results[0], background_theme: 'rainbow' };
    const result = validateAIQuizResponse(quiz, 'personality');
    expect(result.valid).toBe(false);
  });

  it('rechaza más de 10 tags', () => {
    const quiz = validTrivia();
    quiz.tags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
    const result = validateAIQuizResponse(quiz, 'trivia');
    expect(result.valid).toBe(false);
  });

  it('rechaza estimated_minutes fuera de rango', () => {
    const result = validateAIQuizResponse({ ...validTrivia(), estimated_minutes: 0 }, 'trivia');
    expect(result.valid).toBe(false);
  });

  it('rechaza explanation mayor a 500 caracteres, el límite que createQuiz exige', () => {
    const quiz = validTrivia();
    quiz.questions[0].explanation = 'x'.repeat(501);
    const result = validateAIQuizResponse(quiz, 'trivia');
    expect(result.valid).toBe(false);
  });
});

describe('generateQuizWithAI (contrato deepseek-flash sin API real)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function loadRealGenerator() {
    return vi.importActual<typeof import('@/lib/quiz/generator')>('@/lib/quiz/generator');
  }

  it('envía deepseek-flash con thinking disabled, json_object y mide tokens/latencia', async () => {
    const { generateQuizWithAI, DEEPSEEK_API_URL, DEEPSEEK_MODEL } = await loadRealGenerator();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validTrivia()) } }],
          usage: { prompt_tokens: 210, completion_tokens: 640, total_tokens: 850 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await generateQuizWithAI(
      {
        topic: 'space exploration',
        quiz_type: 'trivia',
        difficulty: 'easy',
        num_questions: 3,
        language: 'en',
      },
      'fake-key'
    );

    expect(result.success).toBe(true);
    expect(result.metrics).toMatchObject({
      model: 'deepseek-flash',
      promptTokens: 210,
      completionTokens: 640,
      totalTokens: 850,
      finishReason: 'stop',
    });
    expect(result.metrics?.latencyMs).toBeGreaterThanOrEqual(0);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEEPSEEK_API_URL);
    const sentBody = JSON.parse(String(init.body));
    expect(sentBody.model).toBe(DEEPSEEK_MODEL);
    expect(sentBody.model).toBe('deepseek-flash');
    expect(sentBody.thinking).toEqual({ type: 'disabled' });
    expect(sentBody.response_format).toEqual({ type: 'json_object' });
    expect(sentBody.max_tokens).toBe(4000);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('distingue truncamiento cuando finish_reason es length', async () => {
    const { generateQuizWithAI } = await loadRealGenerator();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'length', message: { content: '{"title":"Cut' } }],
          usage: { prompt_tokens: 200, completion_tokens: 4000, total_tokens: 4200 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as typeof fetch;

    const result = await generateQuizWithAI(
      {
        topic: 'space',
        quiz_type: 'trivia',
        difficulty: 'hard',
        num_questions: 20,
        language: 'en',
      },
      'fake-key'
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('truncated');
    expect(result.metrics?.finishReason).toBe('length');
    expect(result.metrics?.completionTokens).toBe(4000);
  });

  it('distingue timeout por deadline AbortController', async () => {
    const { generateQuizWithAI } = await loadRealGenerator();
    globalThis.fetch = vi.fn((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const result = await generateQuizWithAI(
      { topic: 'space', quiz_type: 'trivia', difficulty: 'easy', num_questions: 3, language: 'en' },
      'fake-key',
      { timeoutMs: 15 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('timeout');
  });

  it('distingue cuota agotada del proveedor (429) de otros fallos HTTP', async () => {
    const { generateQuizWithAI } = await loadRealGenerator();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 })
      ) as typeof fetch;

    const rateLimited = await generateQuizWithAI(
      { topic: 'space', quiz_type: 'trivia', difficulty: 'easy', num_questions: 3, language: 'en' },
      'fake-key'
    );
    expect(rateLimited.success).toBe(false);
    expect(rateLimited.errorCode).toBe('provider_rate_limited');
    expect(rateLimited.httpStatus).toBe(429);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'upstream boom' } }), { status: 503 })
      ) as typeof fetch;

    const upstreamError = await generateQuizWithAI(
      { topic: 'space', quiz_type: 'trivia', difficulty: 'easy', num_questions: 3, language: 'en' },
      'fake-key'
    );
    expect(upstreamError.success).toBe(false);
    expect(upstreamError.errorCode).toBe('provider_error');
    expect(upstreamError.httpStatus).toBe(503);
  });
});

// Caso de ruta: el POST debe responder 502/503/504/429 según la causa real,
// sin exponer prompts, PII ni detalle interno del proveedor.
const { generateSpy, getUserSpy, rateLimitCheck, limiterFactory } = vi.hoisted(() => {
  const rateLimitCheck = vi.fn();
  const limiterFactory = vi.fn((baseKey: string) => ({
    check: (identifier: string, opts?: { record?: boolean }) =>
      rateLimitCheck(baseKey, identifier, opts),
  }));
  return {
    generateSpy: vi.fn(),
    getUserSpy: vi.fn(),
    rateLimitCheck,
    limiterFactory,
  };
});

vi.mock('@/lib/quiz/generator', () => ({
  DEEPSEEK_MODEL: 'deepseek-flash',
  generateQuizWithAI: generateSpy,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: getUserSpy } })),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: limiterFactory,
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quiz/generate/route';

const requestBody = {
  topic: 'space exploration',
  quiz_type: 'trivia',
  difficulty: 'easy',
  num_questions: 3,
  language: 'en',
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quiz/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/quiz/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'test-key';
    delete process.env.DEEPSEEK_DAILY_LIMIT;
    delete process.env.DEEPSEEK_USER_DAILY_LIMIT;
    getUserSpy.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 9, reset: 60 });
  });

  it('responde 401 sin sesión y nunca llama al generador', async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('authentication_required');
    expect(generateSpy).not.toHaveBeenCalled();
    expect(rateLimitCheck).not.toHaveBeenCalled();
  });

  it('rechaza locales fuera del catálogo con 400 invalid_request', async () => {
    const response = await POST(makeRequest({ ...requestBody, language: 'pt' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_request');
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('responde 503 si el limitador falla y no genera', async () => {
    rateLimitCheck.mockResolvedValue({ allowed: false, remaining: 0, reset: 60, errored: true });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('rate_limiter_unavailable');
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('responde 500 provider_misconfigured sin DEEPSEEK_API_KEY y no genera', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('provider_misconfigured');
    expect(JSON.stringify(body)).not.toContain('DEEPSEEK');
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('aplica el límite diario configurable por variable de entorno (0 apaga la generación)', async () => {
    process.env.DEEPSEEK_DAILY_LIMIT = '0';

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('daily_quota_exceeded');
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('responde 429 daily_quota_exceeded cuando se agota el presupuesto diario global sin gastar los otros cupos', async () => {
    process.env.DEEPSEEK_DAILY_LIMIT = '50';
    process.env.DEEPSEEK_USER_DAILY_LIMIT = '5';
    rateLimitCheck.mockImplementation(async (baseKey: string) =>
      baseKey === 'quiz-generate-daily-global'
        ? { allowed: false, remaining: 0, reset: 3600 }
        : { allowed: true, remaining: 5, reset: 60 }
    );

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('daily_quota_exceeded');
    expect(generateSpy).not.toHaveBeenCalled();
    expect(rateLimitCheck).toHaveBeenCalledTimes(4);
    for (const call of rateLimitCheck.mock.calls) {
      expect(call[2]).toEqual({ record: false });
    }
    expect(limiterFactory).toHaveBeenCalledWith('quiz-generate-daily-global', 50, 86_400, 'closed');
    expect(limiterFactory).toHaveBeenCalledWith('quiz-generate-daily-user', 5, 86_400, 'closed');
  });

  it('responde 429 cuando el limitador por usuario se agota y solo consulta en peek', async () => {
    rateLimitCheck.mockImplementation(async (baseKey: string) =>
      baseKey === 'quiz-generate-user'
        ? { allowed: false, remaining: 0, reset: 30 }
        : { allowed: true, remaining: 9, reset: 60 }
    );

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('rate_limited');
    expect(generateSpy).not.toHaveBeenCalled();
    expect(rateLimitCheck).toHaveBeenCalledTimes(4);
    for (const call of rateLimitCheck.mock.calls) {
      expect(call[2]).toEqual({ record: false });
    }
  });

  it('distingue timeout (504), truncamiento (502) y cuota del proveedor (503)', async () => {
    generateSpy.mockResolvedValueOnce({ success: false, errorCode: 'timeout' });
    const timeoutRes = await POST(makeRequest(requestBody));
    expect(timeoutRes.status).toBe(504);
    expect((await timeoutRes.json()).error).toBe('generation_timeout');

    generateSpy.mockResolvedValueOnce({ success: false, errorCode: 'truncated' });
    const truncRes = await POST(makeRequest(requestBody));
    expect(truncRes.status).toBe(502);
    expect((await truncRes.json()).error).toBe('generation_truncated');

    generateSpy.mockResolvedValueOnce({
      success: false,
      errorCode: 'provider_rate_limited',
      httpStatus: 429,
    });
    const quotaRes = await POST(makeRequest(requestBody));
    expect(quotaRes.status).toBe(503);
    expect((await quotaRes.json()).error).toBe('provider_quota_exceeded');
  });

  it('responde 502 sin detalle interno cuando la AI devuelve un quiz roto', async () => {
    const broken = validTrivia();
    broken.questions[0] = triviaQuestion('q1', [
      { id: 'a', text: 'A', is_correct: true },
      { id: 'b', text: 'B', is_correct: true },
    ]);
    generateSpy.mockResolvedValueOnce({ success: true, data: broken });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('invalid_generated_quiz');
    expect(body.details).toBeUndefined();
  });

  it('el código del 502 no depende del idioma de la request', async () => {
    const broken = validTrivia();
    broken.questions[0] = triviaQuestion('q1', [
      { id: 'a', text: 'A', is_correct: true },
      { id: 'b', text: 'B', is_correct: true },
    ]);
    generateSpy.mockResolvedValueOnce({ success: true, data: broken });

    const response = await POST(makeRequest({ ...requestBody, language: 'es' }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('invalid_generated_quiz');
  });

  it('responde 502 generation_failed sin exponer el mensaje del proveedor ni loguear el topic', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    generateSpy.mockResolvedValueOnce({
      success: false,
      errorCode: 'provider_error',
      error: 'DeepSeek API error: 502',
      metrics: {
        model: 'deepseek-flash',
        latencyMs: 120,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        finishReason: null,
      },
    });

    const response = await POST(
      makeRequest({ ...requestBody, topic: 'mi secreto privado pii@example.com' })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('generation_failed');
    expect(JSON.stringify(body)).not.toContain('DeepSeek');
    const serializedLogs = JSON.stringify(errorSpy.mock.calls);
    expect(serializedLogs).not.toContain('mi secreto privado');
    expect(serializedLogs).not.toContain('pii@example.com');
    expect(serializedLogs).not.toContain('user-1');
    errorSpy.mockRestore();
  });

  it('localiza el aviso de conteo de preguntas según language', async () => {
    generateSpy.mockResolvedValue({ success: true, data: validTrivia() });

    const esResponse = await POST(
      makeRequest({ ...requestBody, num_questions: 5, language: 'es' })
    );
    const esBody = await esResponse.json();
    expect(esBody.validationWarnings).toEqual([
      'La IA generó una cantidad de preguntas distinta de la pedida.',
    ]);

    const enResponse = await POST(
      makeRequest({ ...requestBody, num_questions: 5, language: 'en' })
    );
    const enBody = await enResponse.json();
    expect(enBody.validationWarnings).toEqual([
      'The AI generated a different number of questions than requested.',
    ]);
  });

  it('responde 200 únicamente con el objeto parseado (sin campos extra) y sin loguear el topic', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    generateSpy.mockResolvedValueOnce({
      success: true,
      data: { ...validTrivia(), unexpected_extra: 'drop-me' },
      metrics: {
        model: 'deepseek-flash',
        latencyMs: 420,
        promptTokens: 180,
        completionTokens: 520,
        totalTokens: 700,
        finishReason: 'stop',
      },
    });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('quiz');
    expect(body).toHaveProperty('validationWarnings');
    expect(body).toHaveProperty('rateLimit');
    expect(body.quiz.title).toBe('The Ultimate Space Trivia Quiz');
    expect(body.quiz).not.toHaveProperty('unexpected_extra');
    const serializedInfo = JSON.stringify(infoSpy.mock.calls);
    expect(serializedInfo).toContain('deepseek-flash');
    expect(serializedInfo).toContain('700');
    expect(serializedInfo).not.toContain('space exploration');
    infoSpy.mockRestore();
  });
});
