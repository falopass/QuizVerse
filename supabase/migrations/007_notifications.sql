-- ============================================
-- QUIZVERSE MIGRATION 007: Notifications
-- Push notifications for social actions
-- ============================================

CREATE TYPE notification_type AS ENUM (
  'comment',
  'follow',
  'quiz_approved',
  'quiz_rejected',
  'achievement',
  'mention'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function: create notification when someone comments
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    q.creator_id,
    'comment',
    'New comment on your quiz',
    (SELECT display_name FROM profiles WHERE id = NEW.user_id) || ' commented on "' || q.title || '"',
    jsonb_build_object('quiz_id', NEW.quiz_id, 'comment_id', NEW.id, 'user_id', NEW.user_id)
  FROM quizzes q
  WHERE q.id = NEW.quiz_id
    AND q.creator_id <> NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON quiz_comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment();

-- Function: create notification when someone follows
CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'follow',
    'New follower',
    (SELECT display_name FROM profiles WHERE id = NEW.follower_id) || ' started following you',
    jsonb_build_object('follower_id', NEW.follower_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON user_follows
  FOR EACH ROW EXECUTE FUNCTION notify_follow();
