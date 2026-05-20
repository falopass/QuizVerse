import { describe, it, expect } from 'vitest';
import {
  calculateQuestionScore,
  calculatePercentage,
  formatTime,
  calculateTimeBonus,
  createInitialQuizState,
  quizReducer,
  validateQuiz,
} from '@/lib/quiz/engine';
import type { Quiz } from '@/types/quiz';

const triviaQuestion = {
  id: 'q1',
  question: 'Test',
  options: [
    { id: 'o1', text: 'Correct', is_correct: true },
    { id: 'o2', text: 'Wrong', is_correct: false },
  ],
};

const personalityQuestion = {
  id: 'q1',
  question: 'Test',
  options: [
    { id: 'o1', text: 'A', personality_tags: ['introvert'] },
    { id: 'o2', text: 'B', personality_tags: ['extrovert'] },
  ],
};

describe('calculateQuestionScore', () => {
  it('debería marcar trivia correcta', () => {
    const result = calculateQuestionScore(triviaQuestion, 'o1', 'trivia');
    expect(result.is_correct).toBe(true);
    expect(result.score).toBe(1);
  });

  it('debería marcar trivia incorrecta', () => {
    const result = calculateQuestionScore(triviaQuestion, 'o2', 'trivia');
    expect(result.is_correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it('debería retornar personality tags', () => {
    const result = calculateQuestionScore(personalityQuestion, 'o1', 'personality');
    expect(result.personality_tags).toEqual(['introvert']);
    expect(result.is_correct).toBe(false);
  });

  it('debería manejar opción no encontrada', () => {
    const result = calculateQuestionScore(triviaQuestion, 'invalid', 'trivia');
    expect(result.is_correct).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('calculatePercentage', () => {
  it('debería calcular porcentaje', () => {
    expect(calculatePercentage(5, 10)).toBe(50);
  });

  it('debería retornar 0 con max 0', () => {
    expect(calculatePercentage(5, 0)).toBe(0);
  });
});

describe('formatTime', () => {
  it('debería formatear segundos', () => {
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(3599)).toBe('59:59');
  });
});

describe('calculateTimeBonus', () => {
  it('debería calcular bonus por tiempo', () => {
    const bonus = calculateTimeBonus(10, 30, 0.5);
    expect(bonus).toBeGreaterThanOrEqual(0);
    expect(bonus).toBeLessThanOrEqual(5);
  });

  it('debería retornar 0 sin tiempo restante', () => {
    expect(calculateTimeBonus(0, 30)).toBe(0);
  });
});

describe('createInitialQuizState', () => {
  it('debería crear estado inicial', () => {
    const quiz = {
      id: '1',
      title: 'Test',
      quiz_type: 'trivia' as const,
      difficulty: 'easy' as const,
      language: 'es',
      questions: [{ ...triviaQuestion, time_limit_seconds: 20 }],
    } as unknown as Quiz;

    const state = createInitialQuizState(quiz);
    expect(state.status).toBe('idle');
    expect(state.current_question_index).toBe(0);
    expect(state.score).toBe(0);
    expect(state.time_remaining).toBe(20);
  });
});

describe('quizReducer', () => {
  it('debería transicionar idle -> playing', () => {
    const state = {
      status: 'idle' as const,
      current_question_index: 0,
      answers: [],
      score: 0,
      selected_option_id: null,
      is_correct: null,
      time_remaining: 30,
    };
    const next = quizReducer(state, { type: 'START_QUIZ' });
    expect(next.status).toBe('playing');
  });

  it('debería acumular score en SUBMIT_ANSWER', () => {
    const state = {
      status: 'idle' as const,
      current_question_index: 0,
      answers: [],
      score: 0,
      selected_option_id: 'o1',
      is_correct: null,
      time_remaining: 30,
    };
    const next = quizReducer(state, {
      type: 'SUBMIT_ANSWER',
      questionId: 'q1',
      is_correct: true,
      time_ms: 5000,
    });
    expect(next.score).toBe(1);
    expect(next.answers).toHaveLength(1);
  });

  it('debería avanzar NEXT_QUESTION', () => {
    const state = {
      status: 'playing' as const,
      current_question_index: 0,
      answers: [],
      score: 0,
      selected_option_id: 'o1',
      is_correct: true,
      time_remaining: 30,
    };
    const next = quizReducer(state, { type: 'NEXT_QUESTION' });
    expect(next.current_question_index).toBe(1);
    expect(next.selected_option_id).toBeNull();
  });

  it('debería completar quiz', () => {
    const state = {
      status: 'playing' as const,
      current_question_index: 2,
      answers: [],
      score: 2,
      selected_option_id: null,
      is_correct: null,
      time_remaining: 30,
    };
    const next = quizReducer(state, { type: 'COMPLETE_QUIZ' });
    expect(next.status).toBe('completed');
  });
});

describe('validateQuiz', () => {
  it('debería validar quiz trivia correcto', () => {
    const quiz = {
      id: '1',
      title: 'Test Quiz',
      quiz_type: 'trivia',
      difficulty: 'easy',
      language: 'es',
      questions: [
        {
          id: 'q1',
          question: 'Pregunta',
          options: [
            { id: 'o1', text: 'Correcta', is_correct: true },
            { id: 'o2', text: 'Incorrecta', is_correct: false },
          ],
        },
      ],
    } as unknown as Quiz;

    const result = validateQuiz(quiz);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('debería rechazar título corto', () => {
    const quiz = { id: '1', title: 'AB', quiz_type: 'trivia', questions: [] } as unknown as Quiz;
    const result = validateQuiz(quiz);
    expect(result.valid).toBe(false);
  });

  it('debería rechazar trivia sin respuesta correcta única', () => {
    const quiz = {
      id: '1',
      title: 'Test Quiz',
      quiz_type: 'trivia',
      difficulty: 'easy',
      language: 'es',
      questions: [
        {
          id: 'q1',
          question: 'Pregunta',
          options: [
            { id: 'o1', text: 'A', is_correct: false },
            { id: 'o2', text: 'B', is_correct: false },
          ],
        },
      ],
    } as unknown as Quiz;

    const result = validateQuiz(quiz);
    expect(result.valid).toBe(false);
  });

  it('debería exigir resultados en personality', () => {
    const quiz = {
      id: '1',
      title: 'Personality Quiz',
      quiz_type: 'personality',
      difficulty: 'medium',
      language: 'es',
      questions: [personalityQuestion],
      results: [],
    } as unknown as Quiz;

    const result = validateQuiz(quiz);
    expect(result.valid).toBe(false);
  });
});
