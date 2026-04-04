-- ============================================
-- QUIZVERSE SEED DATA
-- Migration 004: Categories
-- ============================================

-- 15 categorías iniciales
INSERT INTO categories (name, slug, icon, color, gradient_from, gradient_to, sort_order) VALUES
('Personality',    'personality',    '🧠', '#7c3aed', '#7c3aed', '#a855f7', 1),
('Movies & TV',    'movies-tv',      '🎬', '#ef4444', '#ef4444', '#f97316', 2),
('Music',          'music',          '🎵', '#ec4899', '#ec4899', '#f472b6', 3),
('Gaming',         'gaming',         '🎮', '#06b6d4', '#06b6d4', '#22d3ee', 4),
('Science',        'science',        '🔬', '#22c55e', '#22c55e', '#4ade80', 5),
('History',        'history',        '📜', '#f59e0b', '#f59e0b', '#fbbf24', 6),
('Sports',         'sports',         '⚽', '#3b82f6', '#3b82f6', '#60a5fa', 7),
('Geography',      'geography',      '🌍', '#14b8a6', '#14b8a6', '#2dd4bf', 8),
('Anime & Manga',  'anime-manga',    '⛩️', '#e11d48', '#e11d48', '#f43f5e', 9),
('Food & Drink',   'food-drink',     '🍕', '#f97316', '#f97316', '#fb923c', 10),
('Literature',     'literature',     '📚', '#8b5cf6', '#8b5cf6', '#a78bfa', 11),
('Technology',     'technology',     '💻', '#0ea5e9', '#0ea5e9', '#38bdf8', 12),
('Pop Culture',    'pop-culture',    '🌟', '#d946ef', '#d946ef', '#e879f9', 13),
('Animals',        'animals',        '🐾', '#84cc16', '#84cc16', '#a3e635', 14),
('Relationships',  'relationships',  '💕', '#f43f5e', '#f43f5e', '#fb7185', 15);

-- Achievements iniciales
INSERT INTO achievements (id, name, description, icon, points_reward, condition_type, condition_value) VALUES
('first_quiz',       'First Steps',       'Complete your first quiz', '🎯', 10, 'plays', 1),
('quiz_addict_10',   'Quiz Addict',       'Complete 10 quizzes', '🔥', 50, 'plays', 10),
('quiz_master_50',   'Quiz Master',       'Complete 50 quizzes', '👑', 150, 'plays', 50),
('perfect_score',    'Flawless',          'Get a perfect score on any quiz', '💎', 25, 'score', 100),
('creator',          'Quiz Creator',      'Create your first quiz', '✏️', 30, 'creates', 1),
('going_viral',      'Going Viral',       'Your quiz reaches 100 plays', '🚀', 50, 'shares', 100),
('internet_famous',  'Internet Famous',   'Your quiz reaches 1000 plays', '🌟', 200, 'shares', 1000),
('week_streak',      'Streak Master',     'Play quizzes 7 days in a row', '📅', 50, 'streak', 7),
('explorer',         'Explorer',          'Play quizzes from 5 different categories', '🗺️', 75, 'categories', 5),
('social_butterfly', 'Social Butterfly',  'Share 10 quiz results', '📤', 40, 'shares', 10);
