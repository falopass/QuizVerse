import type { Database } from '@/types/database';
import type {
  Achievement,
  Answer,
  Category,
  PersonalityResult,
  Profile,
  Question,
  Quiz,
  QuizSessionResult,
} from '@/types/quiz';
import { calculatePercentage } from '@/lib/quiz/engine';
import { inferVisualProfile } from '@/lib/design/visual-profile';

export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type QuizRow = Database['public']['Tables']['quizzes']['Row'];
export type GameSessionRow = Database['public']['Tables']['game_sessions']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type AchievementRow = Database['public']['Tables']['achievements']['Row'];

export function parseAnswers(input: GameSessionRow['answers']): Answer[] | null {
  return Array.isArray(input) ? (input as unknown as Answer[]) : null;
}

export function normalizeGameSession(row: GameSessionRow): QuizSessionResult {
  return {
    id: row.id,
    quiz_id: row.quiz_id,
    player_id: row.player_id,
    score: row.score,
    max_score: row.max_score,
    percentage: calculatePercentage(row.score, row.max_score),
    result_id: row.result_id,
    result_title: row.result_title,
    time_taken_seconds: row.time_taken_seconds,
    answers: parseAnswers(row.answers),
    share_token: row.share_token,
    was_shared: row.was_shared,
    completed_at: row.completed_at,
  };
}

export function normalizeCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    color: row.color,
    gradient_from: row.gradient_from,
    gradient_to: row.gradient_to,
    quiz_count: row.quiz_count,
    sort_order: row.sort_order,
  };
}

export function normalizeProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    points: row.points,
    quizzes_played: row.quizzes_played,
    quizzes_created: row.quizzes_created,
    is_admin: row.is_admin,
    is_verified: row.is_verified,
    preferred_language: row.preferred_language,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function normalizeAchievement(row: AchievementRow): Achievement {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    points_reward: row.points_reward,
    condition_type: row.condition_type,
    condition_value: row.condition_value,
  };
}

export function parseQuestions(
  input: Database['public']['Tables']['quizzes']['Row']['questions']
): Question[] {
  return Array.isArray(input) ? (input as unknown as Question[]) : [];
}

export function parseResults(
  input: Database['public']['Tables']['quizzes']['Row']['results']
): PersonalityResult[] | null {
  return Array.isArray(input) ? (input as unknown as PersonalityResult[]) : null;
}

export function normalizeQuiz(
  row: QuizRow,
  categories: Map<string, Category>,
  creator?: Profile | null
): Quiz {
  const normalizedQuiz: Quiz = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    cover_image_url: row.cover_image_url,
    quiz_type: row.quiz_type,
    difficulty: row.difficulty,
    language: row.language,
    questions: parseQuestions(row.questions),
    results: parseResults(row.results),
    tags: row.tags,
    estimated_minutes: row.estimated_minutes,
    plays_count: row.plays_count,
    shares_count: row.shares_count,
    avg_score: row.avg_score,
    likes_count: row.likes_count,
    status: row.status,
    is_featured: row.is_featured,
    is_ai_generated: row.is_ai_generated,
    published_at: row.published_at,
    created_at: row.created_at,
    category: row.category_id ? (categories.get(row.category_id) ?? null) : null,
    creator: creator ?? null,
  };

  return {
    ...normalizedQuiz,
    visual_profile: inferVisualProfile({
      title: normalizedQuiz.title,
      description: normalizedQuiz.description,
      quiz_type: normalizedQuiz.quiz_type,
      tags: normalizedQuiz.tags,
      category: normalizedQuiz.category ?? null,
      language: normalizedQuiz.language,
    }),
  };
}
