-- 024_limitar_mutaciones_sociales.sql
--
-- Cierre del hallazgo A-16 (límites de escritura social):
--
-- Problema:
--   * `notifications` (007) permitía UPDATE de toda la fila propia sin
--     restringir columnas: un usuario con JWT podía reescribir `title`, `body`,
--     `type` o `data` de sus notificaciones por PostgREST.
--   * `notify_follow()` (007) insertaba una notificación en cada INSERT sobre
--     `user_follows`: un bucle seguir/dejar de seguir llenaba el buzón de la
--     víctima.
--   * `user_follows` (006) permitía INSERT/DELETE directos por PostgREST,
--     saltándose `socialLimiter` de `toggleFollowAction`.
--   * `increment_shares` (013) seguía permitiendo incrementar `shares_count`
--     incluso sobre quizzes no publicados.
--
-- Solución:
--   1. `notifications`: REVOKE UPDATE global + GRANT UPDATE (is_read) a
--      `authenticated` + trigger guard `guard_notifications_update()` que
--      congela el resto de columnas para llamadas con JWT.
--   2. `notify_follow()`: deduplicación por par (following_id, follower_id)
--      con bloqueo consultivo de transacción (`pg_advisory_xact_lock`) e índice
--      parcial de apoyo — un follow repetido no vuelve a notificar.
--   3. `user_follows`: lectura pública conservada; escritura encapsulada en
--      `toggleFollowAction` (`service_role`), cerrando INSERT/DELETE directos
--      para `anon`/`authenticated`.
--   4. `increment_shares`: restringido a quizzes `published` y conservando el
--      GRANT a `anon`/`authenticated`/`service_role` para no romper compartir
--      mientras L3 traslada `incrementShares` al escritor de servidor (la
--      revocación final de `anon`/`authenticated` corresponde a L3 una vez
--      desplegado su código).
--
-- Orden y compatibilidad:
--   * Desplegar el código de L2 (`toggleFollowAction` con `createServiceClient`)
--     ANTES de aplicar esta migración en producción.
--   * Compatible con el código vigente de L3 (`incrementShares` sigue
--     funcionando y compartir sigue navegable).
--   * Idempotente: CREATE OR REPLACE, DROP/CREATE POLICY y TRIGGER, CREATE
--     INDEX IF NOT EXISTS y REVOKE/GRANT repetibles.

-- ============================================
-- 1. Notifications: UPDATE solo sobre is_read
-- ============================================

CREATE OR REPLACE FUNCTION public.guard_notifications_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role, triggers DEFINER y mantenimiento pasan libres.
  IF auth.uid() IS NULL OR current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo se puede actualizar is_read en notifications'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_notifications_update() IS
  'Segunda capa tras GRANT UPDATE (is_read): impide que llamadas con JWT modifiquen cualquier columna distinta de is_read.';

DROP TRIGGER IF EXISTS trigger_guard_notifications_update ON public.notifications;
CREATE TRIGGER trigger_guard_notifications_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notifications_update();

REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- ============================================
-- 2. Deduplicar notificaciones de follow por par
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_follow_pair
  ON public.notifications (user_id, (data->>'follower_id'))
  WHERE type = 'follow';

CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;

  -- Serializa carreras concurrentes para el mismo par sin fallar ante
  -- históricos ya duplicados antes de aplicar la migración.
  PERFORM pg_advisory_xact_lock(
    hashtext('notify_follow:' || NEW.following_id::text || ':' || NEW.follower_id::text)
  );

  IF EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE user_id = NEW.following_id
      AND type = 'follow'
      AND data->>'follower_id' = NEW.follower_id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(username, ''), 'Someone')
    INTO v_follower_name
  FROM public.profiles
  WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'follow',
    'New follower',
    COALESCE(v_follower_name, 'Someone') || ' started following you',
    jsonb_build_object('follower_id', NEW.follower_id)
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_follow() IS
  'Emite una sola notificación de follow por par (following_id, follower_id): seguir, dejar de seguir y volver a seguir no spamea al destinatario.';

-- ============================================
-- 3. user_follows: escritura solo desde la acción validada (service_role)
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can follow" ON public.user_follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_insert_none" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_delete_none" ON public.user_follows;

CREATE POLICY "user_follows_insert_none" ON public.user_follows
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "user_follows_delete_none" ON public.user_follows
  FOR DELETE
  USING (false);

COMMENT ON POLICY "user_follows_insert_none" ON public.user_follows IS
  'Sin inserts directos desde PostgREST: toggleFollowAction escribe con service_role tras aplicar socialLimiter.';
COMMENT ON POLICY "user_follows_delete_none" ON public.user_follows IS
  'Sin deletes directos desde PostgREST: toggleFollowAction borra con service_role tras aplicar socialLimiter.';

REVOKE INSERT, UPDATE, DELETE ON public.user_follows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_follows TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_follows TO service_role;

-- ============================================
-- 4. increment_shares: solo quizzes publicados; revocación diferida a L3
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_shares(quiz_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.quizzes
  SET shares_count = shares_count + 1
  WHERE id = quiz_uuid
    AND status = 'published';
END;
$$;

COMMENT ON FUNCTION public.increment_shares(UUID) IS
  'Incrementa shares_count solo en quizzes publicados. Mantiene EXECUTE para anon/authenticated hasta que L3 despliegue el escritor de servidor para shares.';

REVOKE EXECUTE ON FUNCTION public.increment_shares(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_shares(UUID) TO anon, authenticated, service_role;
