-- 031_indices_catalogo_y_ranking.sql
--
-- Índices compuestos para catálogo paginado, hubs de categoría, búsqueda
-- en descripción, Novedades/feed y desempate estable del ranking, más RPC de
-- una sola consulta para el ranking de amigos (`?scope=friends`).
--
-- Reglas:
--   * Idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`).
--   * No elimina ningún índice existente por nombre.
--   * La aplicación funciona igual antes y después de aplicar esta migración:
--     `GET /api/leaderboard?scope=friends` detecta si `get_friends_leaderboard`
--     aún no está disponible y cae al camino compatible de dos consultas.

-- ============================================
-- 1. Índices compuestos del catálogo publicado
-- ============================================

-- Catálogo general por idioma ordenado por popularidad + desempate por id/fecha.
CREATE INDEX IF NOT EXISTS idx_quizzes_published_lang_popular_id
  ON public.quizzes (language, plays_count DESC, id ASC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_quizzes_published_lang_popular_created
  ON public.quizzes (language, plays_count DESC, created_at DESC)
  WHERE status = 'published';

-- Hubs de categoría (`/[locale]/category/[slug]` y `GET /api/quizzes?category=`).
CREATE INDEX IF NOT EXISTS idx_quizzes_published_cat_lang_popular_id
  ON public.quizzes (category_id, language, plays_count DESC, id ASC)
  WHERE status = 'published';

-- Hubs de tipo (`/[locale]/category/trivia`, `/[locale]/category/personality`
-- y filtros combinados por `quiz_type`).
CREATE INDEX IF NOT EXISTS idx_quizzes_published_type_lang_popular_id
  ON public.quizzes (quiz_type, language, plays_count DESC, id ASC)
  WHERE status = 'published';

-- Novedades (`/[locale]/novedades`) y feed Atom (`/[locale]/feed.xml`).
CREATE INDEX IF NOT EXISTS idx_quizzes_published_lang_recent_id
  ON public.quizzes (language, published_at DESC, created_at DESC, id DESC)
  WHERE status = 'published';

-- Búsqueda por subcadena (`description ILIKE '%...%'`) en `GET /api/quizzes`,
-- complementando a `idx_quizzes_title_trgm` de 001.
CREATE INDEX IF NOT EXISTS idx_quizzes_description_trgm
  ON public.quizzes USING GIN (description gin_trgm_ops)
  WHERE status = 'published' AND description IS NOT NULL;

-- ============================================
-- 2. Índice de ranking global y desempate
-- ============================================

-- Cubre `ORDER BY points DESC, quizzes_played DESC, id ASC` de `getLeaderboard`,
-- `getGlobalRank` y el ranking entre amigos.
CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_order
  ON public.profiles (points DESC, quizzes_played DESC, id ASC);

-- ============================================
-- 3. RPC de una sola consulta para ranking de amigos
-- ============================================

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  points INTEGER,
  quizzes_played INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         p.points,
         p.quizzes_played
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (
      p.id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.user_follows f
        WHERE f.follower_id = auth.uid()
          AND f.following_id = p.id
      )
    )
  ORDER BY p.points DESC, p.quizzes_played DESC, p.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 101)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_friends_leaderboard(INTEGER, INTEGER) IS
  'Ranking paginado entre el usuario autenticado (auth.uid()) y las cuentas que sigue, en una sola consulta con desempate estable (points DESC, quizzes_played DESC, id ASC).';

REVOKE EXECUTE ON FUNCTION public.get_friends_leaderboard(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard(INTEGER, INTEGER)
  TO authenticated, service_role;
