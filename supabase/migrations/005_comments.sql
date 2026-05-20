-- ============================================
-- QUIZVERSE MIGRATION 005: Comments
-- Social feature: users can comment on quizzes
-- ============================================

CREATE TABLE IF NOT EXISTS quiz_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES quiz_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_quiz_id ON quiz_comments(quiz_id);
CREATE INDEX idx_comments_user_id ON quiz_comments(user_id);
CREATE INDEX idx_comments_parent_id ON quiz_comments(parent_id);
CREATE INDEX idx_comments_created_at ON quiz_comments(created_at DESC);

ALTER TABLE quiz_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on published quizzes
CREATE POLICY "Anyone can read comments"
  ON quiz_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_comments.quiz_id
      AND quizzes.status = 'published'
    )
  );

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can comment"
  ON quiz_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can edit their own comments
CREATE POLICY "Users can edit own comments"
  ON quiz_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON quiz_comments FOR DELETE
  USING (auth.uid() = user_id);
