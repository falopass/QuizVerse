import { describe, expect, it, vi } from 'vitest';
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
  it('acepta una trivia válida', () => {
    const result = validateAIQuizResponse(validTrivia(), 'trivia');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('acepta una personality válida con 4 resultados', () => {
    const result = validateAIQuizResponse(validPersonality(), 'personality');
    expect(result.valid).toBe(true);
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

  it('acepta personality_tag null, que el prompt permite y createQuiz persiste', () => {
    const quiz = validPersonality();
    (quiz.results[0] as { personality_tag: string | null }).personality_tag = null;
    const result = validateAIQuizResponse(quiz, 'personality');
    expect(result.valid).toBe(true);
  });

  it('rechaza explanation mayor a 500 caracteres, el límite que createQuiz exige', () => {
    const quiz = validTrivia();
    quiz.questions[0].explanation = 'x'.repeat(501);
    const result = validateAIQuizResponse(quiz, 'trivia');
    expect(result.valid).toBe(false);
  });
});

// Caso de ruta: el POST debe responder 502 (no 200) cuando la AI devuelve
// un quiz estructuralmente roto, sin exponer el detalle interno.
const { generateSpy } = vi.hoisted(() => ({ generateSpy: vi.fn() }));

vi.mock('@/lib/quiz/generator', () => ({
  generateQuizWithAI: generateSpy,
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: {
    check: vi.fn(async () => ({ allowed: true, remaining: 9, reset: 60 })),
  },
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
  it('responde 502 sin detalle interno cuando la AI devuelve un quiz roto', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const broken = validTrivia();
    broken.questions[0] = triviaQuestion('q1', [
      { id: 'a', text: 'A', is_correct: true },
      { id: 'b', text: 'B', is_correct: true },
    ]);
    generateSpy.mockResolvedValueOnce({ success: true, data: broken });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('Generated quiz is invalid');
    expect(body.details).toBeUndefined();
  });

  it('responde el 502 en español cuando la request pide language es', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const broken = validTrivia();
    broken.questions[0] = triviaQuestion('q1', [
      { id: 'a', text: 'A', is_correct: true },
      { id: 'b', text: 'B', is_correct: true },
    ]);
    generateSpy.mockResolvedValueOnce({ success: true, data: broken });

    const response = await POST(makeRequest({ ...requestBody, language: 'es' }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('El quiz generado no es válido');
  });

  it('responde 200 con la forma habitual cuando el quiz es válido', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    generateSpy.mockResolvedValueOnce({ success: true, data: validTrivia() });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('quiz');
    expect(body).toHaveProperty('validationWarnings');
    expect(body).toHaveProperty('rateLimit');
    expect(body.quiz.title).toBe('The Ultimate Space Trivia Quiz');
  });
});
