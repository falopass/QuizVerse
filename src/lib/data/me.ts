import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { liveStreak } from '@/lib/quiz/streak';
import type { QuizType } from '@/types/database';

export const MY_ACTIVITY_LIMIT = 30;

interface SessionQuiz {
  slug: string;
  title: string;
  language: string;
  quiz_type: QuizType;
}

export interface MyActivitySession {
  id: string;
  score: number;
  max_score: number;
  result_title: string | null;
  share_token: string;
  completed_at: string;
  quiz: SessionQuiz | null;
}

export interface MyActivity {
  sessions: MyActivitySession[];
  played: number;
  points: number;
  /** Racha actual en días (migración 018); 0 si aún no se aplicó. */
  currentStreak: number;
  /** Mejor racha histórica (migración 018); 0 si aún no se aplicó. */
  longestStreak: number;
  /** true si falló la consulta de partidas: la UI avisa, no muestra «vacío». */
  sessionsFailed: boolean;
}

/**
 * Historial privado de «Mi actividad»: las últimas MY_ACTIVITY_LIMIT partidas
 * del jugador con el quiz de cada una para enlazar a su `/result?s=<token>`.
 * La política RLS `game_sessions_read` ya deja ver solo las propias; el
 * `.eq('player_id', ...)` lo hace explícito en la consulta. Los totales salen
 * de `profiles`, que el trigger `award_quiz_points` mantiene
 * (`quizzes_played`, `points`): son acumulados de por vida, así que pueden
 * superar el historial visible (límite de 30 y sesiones borradas en cascada
 * con su quiz). Si falta la fila, las partidas se cuentan por lo traído y los
 * puntos quedan en 0.
 */
export async function getMyActivity(userId: string): Promise<MyActivity> {
  const supabase = await createClient();
  const [sessionsResult, profileResult] = await Promise.all([
    supabase
      .from('game_sessions')
      .select(
        'id, score, max_score, result_title, share_token, completed_at, quiz:quizzes(slug, title, language, quiz_type)'
      )
      .eq('player_id', userId)
      .order('completed_at', { ascending: false })
      .limit(MY_ACTIVITY_LIMIT),
    supabase
      .from('profiles')
      .select('points, quizzes_played, current_streak, longest_streak, last_played_on')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  // Las columnas de racha son de la migración 018: si aún no se aplicó la
  // consulta falla entera, así que se reintenta sin ellas para no perder los
  // totales que sí existen.
  let profile = profileResult.data;
  if (profileResult.error) {
    const { data: legacy } = await supabase
      .from('profiles')
      .select('points, quizzes_played')
      .eq('id', userId)
      .maybeSingle();
    profile = legacy
      ? { ...legacy, current_streak: 0, longest_streak: 0, last_played_on: null }
      : null;
  }

  const sessions = (sessionsResult.data ?? []).map((row) => {
    const quizRow = row.quiz as SessionQuiz | SessionQuiz[] | null;
    const quiz = (Array.isArray(quizRow) ? (quizRow[0] ?? null) : quizRow) ?? null;
    return {
      id: row.id,
      score: row.score,
      max_score: row.max_score,
      result_title: row.result_title,
      share_token: row.share_token,
      completed_at: row.completed_at,
      quiz,
    };
  });

  return {
    sessions,
    played: profile?.quizzes_played ?? sessions.length,
    points: profile?.points ?? 0,
    currentStreak: liveStreak(profile?.current_streak ?? 0, profile?.last_played_on ?? null),
    longestStreak: profile?.longest_streak ?? 0,
    sessionsFailed: sessionsResult.error !== null,
  };
}
