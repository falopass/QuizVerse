-- 011_first_quiz_single_owner.sql
-- El desbloqueo de logros pasa a tener un solo dueño: checkAchievements() en la
-- app. Antes award_quiz_points() insertaba first_quiz durante el INSERT en
-- game_sessions, asi que checkAchievements() lo veia ya existente y jamas lo
-- devolvia en achievements_unlocked: el aviso de "primer quiz" nunca llegaba al
-- cliente. El trigger conserva su rol original (puntos por partida y contador);
-- el premio de first_quiz lo otorga la app leyendo achievements.points_reward,
-- con el mismo total de puntos. El bloqueo en la app es ademas idempotente y se
-- autocorrige: a quien le falte first_quiz se lo otorga en su proxima partida.
CREATE OR REPLACE FUNCTION award_quiz_points()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER := 10;
BEGIN
  IF NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.max_score > 0 AND NEW.score = NEW.max_score THEN
    points_earned := points_earned + 25;
  END IF;

  UPDATE public.profiles
  SET points = points + points_earned,
      quizzes_played = quizzes_played + 1,
      updated_at = NOW()
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
