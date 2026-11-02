/**
 * Modos de juego que cada tipo de quiz puede ofrecer.
 *
 * Solo trivia tiene veredicto por pregunta: los quizzes de personalidad (y los
 * polls) se juegan en Clásico, sin prometer explicaciones ni contrarreloj.
 */

import type { GameMode } from '@/stores/quiz-store';
import type { Quiz } from '@/types/quiz';

const TRIVIA_MODES: GameMode[] = ['normal', 'timed', 'survival', 'practice'];
const CLASSIC_ONLY: GameMode[] = ['normal'];

export function availableGameModes(quiz: Pick<Quiz, 'quiz_type'>): GameMode[] {
  return quiz.quiz_type === 'trivia' ? TRIVIA_MODES : CLASSIC_ONLY;
}

/** `?mode=` de la URL. `classic` es el nombre público del modo `normal`. */
const MODE_FROM_PARAM: Record<string, GameMode> = {
  classic: 'normal',
  normal: 'normal',
  timed: 'timed',
  survival: 'survival',
  practice: 'practice',
};

/**
 * Modo con el que arranca `/play`: el pedido por la URL si ese quiz lo ofrece;
 * Clásico en cualquier otro caso (entrada directa, modo inválido o prohibido).
 */
export function parseInitialGameMode(
  param: string | undefined,
  quiz: Pick<Quiz, 'quiz_type'>
): GameMode {
  const requested = param ? MODE_FROM_PARAM[param] : undefined;
  return requested && availableGameModes(quiz).includes(requested) ? requested : 'normal';
}
