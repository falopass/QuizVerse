-- 009 — Alta de usuario: username saneado y sin colisiones
--
-- Problema: `handle_new_user()` construye el username con
--   lower(replace(name, ' ', '_'))
-- y `profiles.username` tiene `CHECK (username ~ '^[a-z0-9_]{3,24}$')`.
-- Cualquier nombre con tilde, emoji, punto o guion rompe el signup, y dos
-- personas con el mismo nombre rompen la UNIQUE. Con 0 filas en `profiles`
-- el fallo nunca se vio en producción, pero está a un registro de distancia.
--
-- Solución: misma regla que `src/lib/auth/identity.ts` (normalizeUsername),
-- resuelta en el trigger con sufijo del UUID para que sea determinista.
--
-- Rollback (pegar y ejecutar si hay que volver atrás):
--   CREATE OR REPLACE FUNCTION public.handle_new_user()
--   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
--   SET search_path = public, pg_temp AS $$
--   BEGIN
--     INSERT INTO profiles (id, username, display_name, avatar_url)
--     VALUES (
--       NEW.id,
--       LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'name', 'user_' || LEFT(NEW.id::TEXT, 8)), ' ', '_')),
--       COALESCE(NEW.raw_user_meta_data->>'name', 'New Player'),
--       COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
--     );
--     RETURN NEW;
--   END;
--   $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  raw_name text;
  base     text;
  candidate text;
  suffix   text;
  attempt  integer := 0;
BEGIN
  -- El cliente manda `name`; `display_name` y `full_name` cubren formularios
  -- antiguos y proveedores OAuth.
  raw_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'player'
  );

  -- Plegado ASCII: NFD separa los diacríticos y la clase los elimina.
  base := lower(translate(
    raw_name,
    'áàâäãåéèêëíìîïóòôöõúùûüñçýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇÝ',
    'aaaaaaeeeeiiiiooooouuuuncyyAAAAAAEEEEIIIIOOOOOUUUUNCY'
  ));
  base := regexp_replace(base, '[^a-z0-9]+', '_', 'g');
  base := regexp_replace(base, '_{2,}', '_', 'g');
  base := regexp_replace(base, '^_+|_+$', '', 'g');
  base := left(base, 24);

  IF length(base) < 3 THEN
    base := 'player';
  END IF;

  candidate := base;

  -- Hasta 6 intentos; el sufijo sale del UUID, así que es estable.
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    attempt := attempt + 1;
    EXIT WHEN attempt > 6;

    suffix := left(replace(NEW.id::text, '-', ''), 3 + attempt);
    candidate := left(base, 24 - length(suffix) - 1) || '_' || suffix;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    candidate,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      'New Player'
    ),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crea el perfil al alta. Normaliza el username a ^[a-z0-9_]{3,24}$ y resuelve colisiones con sufijo del UUID (migración 009).';
