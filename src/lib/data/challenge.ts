import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchSessionByShareToken } from '@/lib/data/game-session';
import { parseAnswers } from '@/lib/data/normalizers';
import type { ChallengeInfo } from '@/lib/quiz/challenge';
import { personalityTagsFromAnswers, type CompatibilityPeer } from '@/lib/quiz/compatibility';
import type { Quiz } from '@/types/quiz';

/**
 * Resuelve un token de reto, pero solo si pertenece a este quiz.
 *
 * Un token de otro quiz no debe pintar un marcador: sería un desafío sobre un
 * quiz distinto al que se está jugando.
 */
export async function getChallengeForQuiz(
  token: string,
  quizId: string
): Promise<ChallengeInfo | null> {
  if (!token) return null;

  const supabase = await createClient();
  const row = await fetchSessionByShareToken(supabase, token);
  if (!row || row.quiz_id !== quizId) return null;

  return {
    token,
    score: row.score ?? 0,
    maxScore: row.max_score ?? 0,
    resultTitle: row.result_title ?? null,
  };
}

/**
 * El reto de un test de personalidad: el marcador de `ChallengeInfo` más los
 * tags que el retador acumuló al responder — lo que la tarjeta de
 * compatibilidad compara contra la partida del retado.
 *
 * Los tags se derivan en servidor de `game_sessions.answers` y de las
 * opciones del quiz (`personality_tags` es dato público tras la 015): al
 * cliente solo llega el vector agregado y el resultado, nunca las respuestas
 * sueltas ni nada que identifique al retador.
 */
export interface PersonalityChallenge extends ChallengeInfo, CompatibilityPeer {
  resultTitle: string | null;
}

/**
 * Igual que `getChallengeForQuiz` —un token de otro quiz no resuelve nada—
 * pero enriquecido con los tags del retador para la comparación.
 */
export async function getPersonalityChallengeForQuiz(
  token: string,
  quiz: Pick<Quiz, 'id' | 'questions'>
): Promise<PersonalityChallenge | null> {
  if (!token) return null;

  const supabase = await createClient();
  const row = await fetchSessionByShareToken(supabase, token);
  if (!row || row.quiz_id !== quiz.id) return null;

  return {
    token,
    score: row.score ?? 0,
    maxScore: row.max_score ?? 0,
    resultTitle: row.result_title ?? null,
    resultId: row.result_id ?? null,
    tags: personalityTagsFromAnswers(quiz.questions, parseAnswers(row.answers) ?? []),
  };
}
