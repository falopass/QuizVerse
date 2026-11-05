-- 022_analytics_events.sql
--
-- Analítica persistente de crecimiento: /api/analytics validaba los
-- eventos y solo los volcaba con console.info en los logs del Worker,
-- así que la sección «Origen de visitas» de /admin/estadisticas no tenía
-- tabla consultable. Aquí se guardan los eventos de la lista blanca de
-- la app (page_view, quiz_start, quiz_complete, share_click,
-- invite_landing) y el panel los agrega en ventanas de 7 y 30 días.
--
-- Privacidad por diseño: sin IP, sin user agent, sin ids de usuario, sin
-- tokens ni query string (la app recorta el path antes de insertar y el
-- CHECK lo refuerza). Lo más identificable es el canal de origen.
--
-- Acceso: RLS activada y sin policies — anon/authenticated no leen ni
-- escriben nada. Escribe y lee solo service_role: la API inserta y el
-- panel agrega, ambos en el servidor. Los REVOKE explícitos quitan hasta
-- los default privileges: sin grant, PostgREST ni expone la tabla a esos
-- roles.
--
-- Retención: delete_old_analytics_events() borra lo de más de 180 días.
-- Ejecutarla a mano o programarla con pg_cron, igual que
-- cleanup_old_game_sessions (migración 003): corre como definer, así que
-- service_role o el owner pueden invocarla sin necesitar DELETE.
--
-- Idempotente: create table/index if not exists, create or replace
-- function, grants y revokes repetibles. La app funciona sin aplicarla:
-- la inserción detecta la tabla ausente y sigue respondiendo igual, y el
-- panel muestra la sección como no disponible.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(name) <= 40),
  locale TEXT CHECK (locale IN ('en', 'es')),
  -- Solo el path: sin query ni hash (los tokens s/challenge/g/via jamás se
  -- guardan). El CHECK lo hace cumplir aunque la app cambie.
  path TEXT CHECK (
    path IS NULL OR (
      path LIKE '/%'
      AND char_length(path) <= 300
      AND position('?' IN path) = 0
      AND position('#' IN path) = 0
    )
  ),
  quiz_slug TEXT CHECK (char_length(quiz_slug) <= 120),
  -- Canal de origen: el canal del share_click ('whatsapp', 'copy', …) y,
  -- para invite_landing y quiz_complete atribuida, 'via:<canal>' o
  -- 'invite:challenge' / 'invite:g'.
  source TEXT CHECK (char_length(source) <= 120),
  value DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analytics_events IS
  'Eventos de crecimiento (lista blanca de /api/analytics). Sin PII: ni IP, ni user agent, ni ids, ni query string. Solo service_role.';

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created_at
  ON public.analytics_events (name, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Sin policies: con RLS activada, anon y authenticated no pueden nada.
REVOKE ALL ON public.analytics_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.analytics_events TO service_role;

CREATE OR REPLACE FUNCTION public.delete_old_analytics_events()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.delete_old_analytics_events() IS
  'Retención de analítica: borra eventos de más de 180 días. Manual o vía pg_cron; solo service_role/owner.';

REVOKE EXECUTE ON FUNCTION public.delete_old_analytics_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_old_analytics_events() TO service_role;
