/**
 * Quiz Game Store - Zustand
 * Maneja el estado global del juego
 */

import { create } from 'zustand';
import type { Quiz, Question, Answer, PersonalityResult } from '@/types/quiz';

export type GameMode = 'normal' | 'timed' | 'survival' | 'practice';

export interface PowerUp {
  id: string;
  name: string;
  icon: string;
  description: string;
  used: boolean;
  available: boolean;
}

export interface QuizGameState {
  // Quiz actual
  quiz: Quiz | null;

  // Estado del juego
  gameMode: GameMode;
  currentQuestionIndex: number;
  selectedOptionId: string | null;
  answers: Answer[];
  isCompleted: boolean;
  isPaused: boolean;

  // Tiempo
  timeRemaining: number;
  totalTimeUsed: number;

  // Rachas y bonus
  streak: number;
  maxStreak: number;
  bonusPoints: number;

  // Power-ups
  powerUps: PowerUp[];

  // Feedback
  lastAnswerCorrect: boolean | null;
  showFeedback: boolean;

  // Actions
  startGame: (quiz: Quiz, mode?: GameMode) => void;
  selectOption: (optionId: string) => void;
  /**
   * Records the current answer. `verdict` comes from the server (`/api/quiz/reveal`);
   * without it the answer is stored but no feedback is shown, because the browser
   * does not hold the answer key.
   */
  submitAnswer: (verdict?: { isCorrect: boolean }) => void;
  nextQuestion: () => void;
  skipQuestion: () => void;
  usePowerUp: (powerUpId: string) => void;
  togglePause: () => void;
  resetGame: () => void;
  setGameMode: (mode: GameMode) => void;
  showAnswerFeedback: (correct: boolean) => void;
  hideFeedback: () => void;

  // Getters
  getCurrentQuestion: () => Question | null;
  getScore: () => { correct: number; total: number; percentage: number };
  getPersonalityResult: () => PersonalityResult | null;
  getTimeBonus: () => number;
}

// Power-ups disponibles
const DEFAULT_POWER_UPS: PowerUp[] = [
  {
    id: 'fifty-fifty',
    name: '50/50',
    icon: '✂️',
    description: 'Elimina 2 respuestas incorrectas',
    used: false,
    available: true,
  },
  {
    id: 'extra-time',
    name: '+10s',
    icon: '⏰',
    description: 'Añade 10 segundos extra',
    used: false,
    available: true,
  },
  {
    id: 'skip',
    name: 'Skip',
    icon: '⏭️',
    description: 'Saltar esta pregunta',
    used: false,
    available: true,
  },
];

export const useQuizStore = create<QuizGameState>((set, get) => ({
  // Estado inicial
  quiz: null,
  gameMode: 'normal',
  currentQuestionIndex: 0,
  selectedOptionId: null,
  answers: [],
  isCompleted: false,
  isPaused: false,
  timeRemaining: 30,
  totalTimeUsed: 0,
  streak: 0,
  maxStreak: 0,
  bonusPoints: 0,
  powerUps: [...DEFAULT_POWER_UPS],
  lastAnswerCorrect: null,
  showFeedback: false,

  // Actions
  startGame: (quiz: Quiz, mode: GameMode = 'normal') => {
    set({
      quiz,
      gameMode: mode,
      currentQuestionIndex: 0,
      selectedOptionId: null,
      answers: [],
      isCompleted: false,
      isPaused: false,
      timeRemaining:
        mode === 'timed'
          ? quiz.questions.reduce(
              (total, question) => total + (question.time_limit_seconds || 30),
              0
            )
          : 0,
      totalTimeUsed: 0,
      streak: 0,
      maxStreak: 0,
      bonusPoints: 0,
      powerUps: [...DEFAULT_POWER_UPS],
      lastAnswerCorrect: null,
      showFeedback: false,
    });
  },

  selectOption: (optionId: string) => {
    set({ selectedOptionId: optionId });
  },

  submitAnswer: (verdict) => {
    const state = get();
    if (!state.quiz || !state.selectedOptionId) return;

    const question = state.quiz.questions[state.currentQuestionIndex];
    if (!question) return;

    // The browser never holds the answer key: correctness comes from the server.
    const hasVerdict = verdict !== undefined;
    const isCorrect = verdict?.isCorrect ?? false;

    // Calcular tiempo
    const timeTaken =
      state.gameMode === 'timed'
        ? Math.max(
            0,
            state.totalTimeUsed * 1000 -
              state.answers.reduce((total, answer) => total + answer.time_ms, 0)
          )
        : 0;

    // Crear respuesta
    const answer: Answer = {
      question_id: question.id,
      selected_option_id: state.selectedOptionId,
      is_correct: isCorrect,
      time_ms: timeTaken,
    };

    // Actualizar racha
    const newStreak = isCorrect ? state.streak + 1 : 0;
    const maxStreak = Math.max(state.maxStreak, newStreak);

    // Calcular bonus por racha (10% por cada pregunta correcta seguida)
    const streakBonus = newStreak > 1 ? Math.floor(newStreak * 0.1 * 100) : 0;

    set((prev) => ({
      answers: [...prev.answers, answer],
      streak: newStreak,
      maxStreak,
      bonusPoints: prev.bonusPoints + streakBonus,
      lastAnswerCorrect: hasVerdict ? isCorrect : null,
      showFeedback: hasVerdict,
    }));

    const questionIndexAtSubmit = state.currentQuestionIndex;

    // Auto-avanzar: con feedback se deja leer el resultado, sin feedback no se
    // retiene al jugador porque no hay nada que leer.
    setTimeout(
      () => {
        const currentState = get();
        if (
          !currentState.quiz ||
          currentState.quiz.id !== state.quiz?.id ||
          currentState.currentQuestionIndex !== questionIndexAtSubmit
        )
          return;
        if (hasVerdict && !currentState.showFeedback) return;
        if (
          (currentState.gameMode === 'survival' && hasVerdict && !isCorrect) ||
          currentState.currentQuestionIndex === currentState.quiz.questions.length - 1
        ) {
          set({ isCompleted: true });
        } else {
          get().nextQuestion();
        }
      },
      hasVerdict ? 1500 : 350
    );
  },

  nextQuestion: () => {
    const state = get();
    if (!state.quiz) return;

    const nextIndex = state.currentQuestionIndex + 1;
    set({
      currentQuestionIndex: nextIndex,
      selectedOptionId: null,
      showFeedback: false,
      lastAnswerCorrect: null,
    });
  },

  skipQuestion: () => {
    const state = get();
    if (!state.quiz) return;

    // Marcar como respondida incorrectamente
    const question = state.quiz.questions[state.currentQuestionIndex];
    const answer: Answer = {
      question_id: question.id,
      selected_option_id: '',
      is_correct: false,
      time_ms: 0,
    };

    set((prev) => ({
      answers: [...prev.answers, answer],
      streak: 0,
      showFeedback: false,
    }));

    if (
      state.gameMode === 'survival' ||
      state.currentQuestionIndex === state.quiz.questions.length - 1
    ) {
      set({ isCompleted: true });
    } else {
      get().nextQuestion();
    }
  },

  usePowerUp: (powerUpId: string) => {
    const state = get();
    if (!state.quiz) return;

    const powerUp = state.powerUps.find((p) => p.id === powerUpId);
    if (!powerUp || powerUp.used || !powerUp.available) return;

    switch (powerUpId) {
      case 'fifty-fifty':
        // En el componente se manejará visualmente
        break;
      case 'extra-time':
        if (state.gameMode === 'timed') set({ timeRemaining: state.timeRemaining + 10 });
        break;
      case 'skip':
        get().skipQuestion();
        break;
    }

    // Marcar como usado
    set((prev) => ({
      powerUps: prev.powerUps.map((p) => (p.id === powerUpId ? { ...p, used: true } : p)),
    }));
  },

  togglePause: () => {
    set((prev) => ({ isPaused: !prev.isPaused }));
  },

  resetGame: () => {
    const state = get();
    if (state.quiz) {
      get().startGame(state.quiz, state.gameMode);
    }
  },

  setGameMode: (mode: GameMode) => {
    set({ gameMode: mode });
  },

  showAnswerFeedback: (correct: boolean) => {
    set({ lastAnswerCorrect: correct, showFeedback: true });
  },

  hideFeedback: () => {
    set({ showFeedback: false, lastAnswerCorrect: null });
  },

  // Getters
  getCurrentQuestion: () => {
    const state = get();
    if (!state.quiz) return null;
    return state.quiz.questions[state.currentQuestionIndex] || null;
  },

  getScore: () => {
    const state = get();
    if (!state.quiz) return { correct: 0, total: 0, percentage: 0 };

    const correct = state.answers.filter((a) => a.is_correct).length;
    const total = state.quiz.questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correct, total, percentage };
  },

  getPersonalityResult: () => {
    const state = get();
    if (!state.quiz || state.quiz.quiz_type !== 'personality' || !state.quiz.results) {
      return null;
    }

    const tagCounts: Record<string, number> = {};

    state.answers.forEach((answer) => {
      const question = state.quiz!.questions.find((q) => q.id === answer.question_id);
      const option = question?.options.find((o) => o.id === answer.selected_option_id);
      option?.personality_tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const dominantTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    if (!dominantTag) return state.quiz.results[0] || null;

    return (
      state.quiz.results.find((r) => r.personality_tag === dominantTag) ||
      state.quiz.results[0] ||
      null
    );
  },

  getTimeBonus: () => {
    const state = get();
    if (!state.quiz || state.quiz.quiz_type !== 'trivia' || state.gameMode !== 'timed') return 0;

    // Bonus por tiempo restante (hasta 50% extra)
    const totalTime = state.quiz.questions.reduce(
      (total, question) => total + (question.time_limit_seconds || 30),
      0
    );
    const timeRemainingPercent = state.timeRemaining / totalTime;
    const baseScore = state.answers.filter((a) => a.is_correct).length;

    return Math.floor(baseScore * timeRemainingPercent * 0.5);
  },
}));
