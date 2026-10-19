-- 011_fix_follow_trigger_privileges.sql
-- Los triggers de follows/notificaciones corren como SECURITY INVOKER y chocan con RLS:
--
--   * notify_follow() inserta en `notifications`, que tiene RLS sin policy de INSERT
--     (007): Postgres rechaza la notificación y el rollback se lleva el follow entero.
--   * update_follow_counts() actualiza `profiles`, pero `profiles_update_own` (002)
--     solo permite la fila propia: el UPDATE sobre el seguido afecta 0 filas en
--     silencio y followers_count/following_count quedan sin mover.
--   * notify_comment() tiene el mismo defecto raíz que notify_follow(): comentar
--     como usuario autenticado también moría al insertar la notificación.
--
-- SECURITY DEFINER las ejecuta como el dueño de las tablas (postgres, con
-- BYPASSRLS), que es la única vía legítima de escribir notificaciones: no
-- queremos una policy de INSERT abierta que deje fabricar notificaciones
-- ajenas desde el cliente. El search_path ya quedó fijado por la migración
-- 008 para todas las funciones de trigger.

ALTER FUNCTION public.update_follow_counts() SECURITY DEFINER;
ALTER FUNCTION public.notify_follow() SECURITY DEFINER;
ALTER FUNCTION public.notify_comment() SECURITY DEFINER;
