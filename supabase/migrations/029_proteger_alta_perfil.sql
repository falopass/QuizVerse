-- 029 — Proteger alta de perfil: sin prefijo de email y colisión bajo UNIQUE (hallazgo A-21)
--
-- Problemas en 009_fix_signup_username.sql:
--   1. Cuando el alta (p. ej. OAuth sin nombre público) no trae `name`,
--      `display_name` ni `full_name`, el trigger derivaba el username público
--      del prefijo del correo (`split_part(NEW.email, '@', 1)`), exponiendo
--      parte de un dato privado en `profiles` (lectura pública por RLS).
--   2. Resolvía colisiones con un `WHILE EXISTS (...)` previo al `INSERT ...
--      ON CONFLICT (id) DO NOTHING`. Ante dos altas simultáneas con el mismo
--      nombre, ambas superan el `EXISTS` y la segunda falla por `unique_violation`
--      en `profiles_username_key`.
--   3. `display_name` ignoraba `full_name` (que mandan Google y Facebook).
--
-- Solución:
--   - Nunca usar `NEW.email` para construir `username` ni `display_name`.
--     Sin nombre público explícito, genera un fallback público `player_<8hex>`
--     derivado del UUID de `NEW.id`.
--   - Resolver colisiones directamente contra la restricción UNIQUE de
--     `profiles.username` con reintento acotado (`EXCEPTION WHEN unique_violation`),
--     eliminando la carrera TOCTOU en altas simultáneas.
--   - Incluir `full_name` al resolver `display_name`.
--
-- Verificación tras aplicar:
--   SELECT obj_description('public.handle_new_user()'::regprocedure, 'pg_proc');
--   -- Debe mencionar migración 029 y no contener `split_part` ni `NEW.email`.
--
-- Rollback:
--   Volver a ejecutar `supabase/migrations/009_fix_signup_username.sql`.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  raw_name              text;
  resolved_display_name text;
  resolved_avatar_url   text;
  base                  text;
  candidate             text;
  suffix                text;
  id_hex                text;
  attempt               integer := 0;
BEGIN
  id_hex := replace(NEW.id::text, '-', '');

  -- Solo metadatos públicos explícitos (nunca el prefijo del email).
  raw_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'preferred_username'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'user_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), '')
  );

  resolved_display_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    'New Player'
  );

  resolved_avatar_url := NULLIF(btrim(NEW.raw_user_meta_data->>'avatar_url'), '');

  IF raw_name IS NULL THEN
    -- Fallback público determinista sin PII ni prefijo de correo.
    base := 'player';
    candidate := 'player_' || left(id_hex, 8);
  ELSE
    -- Plegado ASCII y saneo equivalente a `normalizeUsername` (`^[a-z0-9_]{3,24}$`).
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
      candidate := 'player_' || left(id_hex, 8);
    ELSE
      candidate := base;
    END IF;
  END IF;

  -- Inserción bajo la restricción UNIQUE: sin pre-lectura EXISTS (cero TOCTOU).
  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, display_name, avatar_url)
      VALUES (
        NEW.id,
        candidate,
        resolved_display_name,
        resolved_avatar_url
      )
      ON CONFLICT (id) DO NOTHING;

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        attempt := attempt + 1;
        IF attempt > 10 THEN
          RAISE;
        END IF;

        IF attempt <= 6 THEN
          -- Sufijo determinista a partir del UUID (4 a 9 caracteres hex).
          suffix := left(id_hex, 3 + attempt);
        ELSE
          -- Entropía adicional si los primeros prefijos del UUID colisionan.
          suffix := left(md5(id_hex || ':' || attempt::text || ':' || clock_timestamp()::text), 8);
        END IF;

        candidate := left(base, 24 - length(suffix) - 1) || '_' || suffix;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crea el perfil al alta sin exponer el prefijo del email y resolviendo colisiones de username bajo la restricción UNIQUE (migración 029).';
