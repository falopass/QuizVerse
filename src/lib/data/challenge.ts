import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchSessionByShareToken } from '@/lib/data/game-session';
import type { ChallengeInfo } from '@/lib/quiz/challenge';

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
