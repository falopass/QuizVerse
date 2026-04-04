-- ============================================
-- QUIZVERSE ROW LEVEL SECURITY
-- Migration 002: RLS Policies
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================

-- Leer: cualquiera puede ver perfiles públicos
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT
  USING (true);

-- Insertar: solo el propio usuario al crearse
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Actualizar: solo el propio usuario
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- QUIZZES
-- ============================================

-- Leer: quizzes publicados son públicos, borradores solo del creador
CREATE POLICY "quizzes_public_read" ON quizzes
  FOR SELECT
  USING (
    status = 'published' OR
    status = 'draft' AND creator_id = auth.uid() OR
    status = 'pending' AND creator_id = auth.uid()
  );

-- Insertar: usuarios autenticados pueden crear quizzes
CREATE POLICY "quizzes_insert_authenticated" ON quizzes
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Actualizar: solo el creador
CREATE POLICY "quizzes_update_own" ON quizzes
  FOR UPDATE
  USING (auth.uid() = creator_id);

-- Delete: solo el creador
CREATE POLICY "quizzes_delete_own" ON quizzes
  FOR DELETE
  USING (auth.uid() = creator_id);

-- ============================================
-- GAME SESSIONS
-- ============================================

-- Insertar: cualquiera (incluso anónimos)
CREATE POLICY "game_sessions_insert_any" ON game_sessions
  FOR INSERT
  WITH CHECK (true);

-- Leer: propias o compartidas
CREATE POLICY "game_sessions_read" ON game_sessions
  FOR SELECT
  USING (
    player_id = auth.uid() OR
    player_id IS NULL OR
    share_token IS NOT NULL
  );

-- ============================================
-- QUIZ LIKES
-- ============================================

-- Leer: público
CREATE POLICY "quiz_likes_public_read" ON quiz_likes
  FOR SELECT
  USING (true);

-- Insertar: solo usuarios autenticados, solo propios
CREATE POLICY "quiz_likes_insert_own" ON quiz_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Delete: solo el usuario que dio like
CREATE POLICY "quiz_likes_delete_own" ON quiz_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- QUIZ REPORTS
-- ============================================

-- Leer: usuarios autenticados pueden ver reports
CREATE POLICY "quiz_reports_read_authenticated" ON quiz_reports
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insertar: usuarios autenticados pueden reportar
CREATE POLICY "quiz_reports_insert_authenticated" ON quiz_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

-- Actualizar: solo admins (resolved, resolved_by)
CREATE POLICY "quiz_reports_update_admin" ON quiz_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- USER ACHIEVEMENTS
-- ============================================

-- Leer: cada usuario ve sus propios logros
CREATE POLICY "user_achievements_read_own" ON user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insertar: sistema (trigger) puede insertar logros
CREATE POLICY "user_achievements_insert_system" ON user_achievements
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- CATEGORIES
-- ============================================

-- Leer: público
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT
  USING (true);

-- Actualizar/Insertar/Delete: solo admins
CREATE POLICY "categories_admin_manage" ON categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- ACHIEVEMENTS
-- ============================================

-- Leer: público
CREATE POLICY "achievements_public_read" ON achievements
  FOR SELECT
  USING (true);

-- Actualizar/Insertar/Delete: solo admins
CREATE POLICY "achievements_admin_manage" ON achievements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
