/**
 * Quiz Engine - Motor de lógica del quiz
 * Maneja scoring, timer y state machine
 */

import type {
  Question,
  Quiz,
  QuizState,
  QuizAction,
  Answer,
  PersonalityResult,
} from '@/types/quiz';

// ============================================
// SCORING
// ============================================

/**
 * Calcula el puntaje de una respuesta
 * Para trivia: retorna 1 si es correcta, 0 si no
 * Para personality: retorna los tags de personalidad
 */
export function calculateQuestionScore(
  question: Question,
  selectedOptionId: string,
  quizType: 'trivia' | 'personality'
): { is_correct: boolean; score: number; personality_tags?: string[] } {
  const selectedOption = question.options.find((o) => o.id === selectedOptionId);

  if (!selectedOption) {
    return { is_correct: false, score: 0 };
  }

  if (quizType === 'trivia') {
    const is_correct = selectedOption.is_correct === true;
    return {
      is_correct,
      score: is_correct ? 1 : 0,
    };
  }

  return {
    is_correct: false,
    score: 0,
    personality_tags: selectedOption.personality_tags || [],
  };
}

/**
 * Calcula el resultado de un personality quiz basado en los tags acumulados
 */
export function calculatePersonalityResult(
  personalityTags: string[],
  results: PersonalityResult[]
): PersonalityResult | null {
  if (results.length === 0) return null;

  // Contar frecuencia de cada tag
  const tagCounts: Record<string, number> = {};
  personalityTags.forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });

  // Encontrar el tag con más ocurrencias
  const dominantTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (!dominantTag) {
    return results[0] || null;
  }

  // Buscar el resultado que corresponde a ese tag
  const result = results.find((r) => r.personality_tag === dominantTag);

  return result || results[0] || null;
}

/**
 * Calcula el porcentaje de respuestas correctas
 */
export function calculatePercentage(score: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}

// ============================================
// TIMER
// ============================================

/**
 * Formatea segundos en formato MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calcula puntos bonus por tiempo restante
 */
export function calculateTimeBonus(
  timeRemaining: number,
  timeLimit: number,
  bonusPercentage: number = 0.5
): number {
  if (timeRemaining <= 0) return 0;
  const timeRatio = timeRemaining / timeLimit;
  return Math.floor(bonusPercentage * timeRatio);
}

// ============================================
// STATE MACHINE
// ============================================

/**
 * Crea el estado inicial para un quiz
 */
export function createInitialQuizState(quiz: Quiz): QuizState {
  return {
    status: 'idle',
    current_question_index: 0,
    answers: [],
    score: 0,
    selected_option_id: null,
    is_correct: null,
    time_remaining: quiz.questions[0]?.time_limit_seconds || 30,
  };
}

/**
 *Reducer para el estado del quiz
 */
export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START_QUIZ':
      return {
        ...state,
        status: 'playing',
      };

    case 'SELECT_OPTION':
      return {
        ...state,
        selected_option_id: action.optionId,
      };

    case 'SUBMIT_ANSWER': {
      const newAnswer: Answer = {
        question_id: action.questionId,
        selected_option_id: state.selected_option_id!,
        is_correct: action.is_correct,
        time_ms: action.time_ms,
      };

      return {
        ...state,
        answers: [...state.answers, newAnswer],
        score: action.is_correct ? state.score + 1 : state.score,
        is_correct: action.is_correct,
      };
    }

    case 'NEXT_QUESTION':
      return {
        ...state,
        current_question_index: state.current_question_index + 1,
        selected_option_id: null,
        is_correct: null,
      };

    case 'COMPLETE_QUIZ':
      return {
        ...state,
        status: 'completed',
      };

    case 'TICK_TIME':
      return {
        ...state,
        time_remaining: action.remaining,
      };

    case 'RESET':
      return createInitialQuizState(action.quiz);

    default:
      return state;
  }
}

// ============================================
// VALIDATION
// ============================================

/**
 * Valida que un quiz tenga la estructura correcta
 */
export function validateQuiz(quiz: Quiz): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!quiz.title || quiz.title.length < 5) {
    errors.push('El título debe tener al menos 5 caracteres');
  }

  if (quiz.questions.length === 0) {
    errors.push('El quiz debe tener al menos una pregunta');
  }

  quiz.questions.forEach((q, index) => {
    if (!q.question || q.question.trim() === '') {
      errors.push(`La pregunta ${index + 1} está vacía`);
    }

    if (q.options.length < 2) {
      errors.push(`La pregunta ${index + 1} debe tener al menos 2 opciones`);
    }

    if (quiz.quiz_type === 'trivia') {
      const correctOptions = q.options.filter((o) => o.is_correct === true);
      if (correctOptions.length !== 1) {
        errors.push(`La pregunta ${index + 1} debe tener exactamente una respuesta correcta`);
      }
    }
  });

  if (quiz.quiz_type === 'personality' && (!quiz.results || quiz.results.length === 0)) {
    errors.push('Los quizzes de personalidad deben tener resultados definidos');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
