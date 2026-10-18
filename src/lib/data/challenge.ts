import 'server-only';

import { createClient } from '@/lib/supabase/server';
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
  const { data, error } = await supabase
    .from('game_sessions')
    .select('score, max_score, result_title')
    .eq('share_token', token)
    .eq('quiz_id', quizId)
    .limit(1);

  if (error) return null;

  const row = (
    data as Array<{ score: number; max_score: number; result_title: string | null }> | null
  )?.[0];
  if (!row) return null;

  return {
    token,
    score: row.score ?? 0,
    maxScore: row.max_score ?? 0,
    resultTitle: row.result_title ?? null,
  };
}
