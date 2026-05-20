'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { Database } from '@/types/database';
import type { Quiz } from '@/types/quiz';

interface ProfileStats {
  points: number;
  quizzes_played: number;
  quizzes_created: number;
}

type QuizInsert = Database['public']['Tables']['quizzes']['Insert'];
type QuizUpdate = Database['public']['Tables']['quizzes']['Update'];
type QuizOwnershipRow = Pick<Database['public']['Tables']['quizzes']['Row'], 'creator_id'>;
type QuizScoringRow = Pick<
  Database['public']['Tables']['quizzes']['Row'],
  'questions' | 'results' | 'quiz_type'
>;
type GameSessionInsert = Database['public']['Tables']['game_sessions']['Insert'];
type GameSessionRow = Database['public']['Tables']['game_sessions']['Row'];
type AchievementInsert = Database['public']['Tables']['user_achievements']['Insert'];
type RpcError = { message: string };

interface SingleResult<T> {
  data: T | null;
  error: RpcError | null;
}

interface LikeRpcResult {
  data: boolean | null;
  error: RpcError | null;
}

interface VoidRpcResult {
  error: RpcError | null;
}

interface QuizzesWriteTable {
  insert: (values: QuizInsert) => { select: () => { single: () => Promise<SingleResult<Quiz>> } };
  update: (values: QuizUpdate) => {
    eq: (column: string, value: string) => Promise<{ error: RpcError | null }>;
  };
  delete: () => { eq: (column: string, value: string) => Promise<{ error: RpcError | null }> };
}

interface GameSessionsWriteTable {
  insert: (values: GameSessionInsert) => {
    select: () => { single: () => Promise<SingleResult<GameSessionRow>> };
  };
}

interface UserAchievementsWriteTable {
  insert: (values: AchievementInsert) => Promise<{ error: RpcError | null }>;
}

interface ProfilesWriteTable {
  update: (values: Database['public']['Tables']['profiles']['Update']) => {
    eq: (column: string, value: string) => Promise<{ error: RpcError | null }>;
  };
}

interface QuizRpcClient {
  rpc: (
    fn: 'increment_plays',
    args: Database['public']['Functions']['increment_plays']['Args']
  ) => Promise<VoidRpcResult>;
  rpcLike: (
    fn: 'toggle_like',
    args: Database['public']['Functions']['toggle_like']['Args']
  ) => Promise<LikeRpcResult>;
}

// ============================================
// SCHEMAS
// ============================================

const createQuizSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().max(300).optional(),
  quiz_type: z.enum(['trivia', 'personality', 'poll']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  language: z.string().default('en'),
  category_id: z.string().uuid().optional(),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          is_correct: z.boolean().optional(),
          personality_tags: z.array(z.string()).optional(),
        })
      ),
      explanation: z.string().optional(),
      time_limit_seconds: z.number().optional(),
    })
  ),
  results: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        min_score: z.number().optional(),
        max_score: z.number().optional(),
        personality_tag: z.string().optional(),
        background_theme: z.enum(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']).optional(),
      })
    )
    .optional(),
  tags: z.array(z.string()).default([]),
  estimated_minutes: z.number().default(3),
});

// ============================================
// QUIZ ACTIONS
// ============================================

export async function createQuiz(input: unknown) {
  const supabase = await createClient();

  // Validate input
  const parsed = createQuizSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Profile not found' };
  }

  const profileData = profile as { id: string; is_admin: boolean };
  const quizzesWrite = supabase.from('quizzes') as unknown as QuizzesWriteTable;

  // Generate a locale-aware slug and avoid collisions before insert.
  const slug = await generateUniqueSlug(supabase, parsed.data.title, parsed.data.language);

  // Create quiz
  const quizInsert: QuizInsert = {
    ...parsed.data,
    creator_id: user.id,
    slug,
    status: profileData.is_admin ? 'published' : 'pending',
  };

  const { data: quiz, error } = await quizzesWrite.insert(quizInsert).select().single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/quiz');
  revalidatePath('/');

  return { success: true, quiz };
}

export async function updateQuiz(id: string, input: Partial<Quiz>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  // Check ownership
  const { data: quiz } = await supabase.from('quizzes').select('creator_id').eq('id', id).single();

  if (!quiz || (quiz as QuizOwnershipRow).creator_id !== user.id) {
    return { error: 'Not authorized' };
  }

  const quizzesWrite = supabase.from('quizzes') as unknown as QuizzesWriteTable;
  const { error } = await quizzesWrite.update(input as QuizUpdate).eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/quiz/${id}`);
  revalidatePath('/quiz');

  return { success: true };
}

export async function deleteQuiz(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  // Check ownership
  const { data: quiz } = await supabase.from('quizzes').select('creator_id').eq('id', id).single();

  if (!quiz || (quiz as QuizOwnershipRow).creator_id !== user.id) {
    return { error: 'Not authorized' };
  }

  const quizzesWrite = supabase.from('quizzes') as unknown as QuizzesWriteTable;
  const { error } = await quizzesWrite.delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/quiz');
  revalidatePath('/');

  return { success: true };
}

export async function submitQuizResult(
  quizId: string,
  answers: Array<{
    question_id: string;
    selected_option_id: string;
    is_correct: boolean;
    time_ms: number;
  }>,
  timeTakenSeconds: number
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get quiz data
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('questions, results, quiz_type')
    .eq('id', quizId)
    .single();

  if (!quiz) {
    return { error: 'Quiz not found' };
  }

  const scoringQuiz = quiz as QuizScoringRow;
  const gameSessionsWrite = supabase.from('game_sessions') as unknown as GameSessionsWriteTable;
  const rpcClient = supabase as unknown as Pick<QuizRpcClient, 'rpc'>;

  // Calculate score
  const questions = scoringQuiz.questions as Array<{
    id: string;
    options: Array<{ id: string; is_correct?: boolean; personality_tags?: string[] }>;
  }>;

  let score = 0;
  let maxScore = 0;

  for (const question of questions) {
    const userAnswer = answers.find((a) => a.question_id === question.id);

    maxScore++;
    if (userAnswer?.is_correct) {
      score++;
    }
  }

  // Determine result for personality quizzes
  let resultId = null;
  let resultTitle = null;

  if (scoringQuiz.quiz_type === 'personality' && scoringQuiz.results) {
    // Simple scoring for personality results
    const personalityScores: Record<string, number> = {};

    for (const answer of answers) {
      const question = questions.find((q) => q.id === answer.question_id);
      const selectedOption = question?.options.find((o) => o.id === answer.selected_option_id);
      const tags = selectedOption?.personality_tags || [];

      for (const tag of tags) {
        personalityScores[tag] = (personalityScores[tag] || 0) + 1;
      }
    }

    // Find result with highest matching tag
    const results = scoringQuiz.results as Array<{
      id: string;
      title: string;
      personality_tag?: string;
    }>;

    const winningTag = Object.entries(personalityScores).sort((a, b) => b[1] - a[1])[0]?.[0];
    const matchingResult = results.find((r) => r.personality_tag === winningTag);

    if (matchingResult) {
      resultId = matchingResult.id;
      resultTitle = matchingResult.title;
    }
  }

  // Create game session
  const sessionInsert: GameSessionInsert = {
    quiz_id: quizId,
    player_id: user?.id || null,
    score,
    max_score: maxScore,
    result_id: resultId,
    result_title: resultTitle,
    time_taken_seconds: timeTakenSeconds,
    answers:
      answers as unknown as Database['public']['Tables']['game_sessions']['Insert']['answers'],
  };

  const { data: session, error } = await gameSessionsWrite.insert(sessionInsert).select().single();

  if (error) {
    return { error: error.message };
  }

  // Increment plays count
  const { error: incrementError } = await rpcClient.rpc('increment_plays', { quiz_uuid: quizId });

  if (incrementError) {
    return { error: incrementError.message };
  }

  // Award points to user
  let pointsEarned = 10; // Base points for completing
  if (score === maxScore) {
    pointsEarned += 25; // Perfect score bonus
  }

  // Profile counters are updated by database triggers to keep stats consistent.

  // Check for achievements
  const achievementsUnlocked = await checkAchievements(user?.id || null);

  return {
    success: true,
    session: session as GameSessionRow,
    result: resultId
      ? (scoringQuiz.results as Array<{ id: string; title: string; description: string }>).find(
          (r) => r.id === resultId
        )
      : null,
    points_earned: pointsEarned,
    achievements_unlocked: achievementsUnlocked,
  };
}

async function checkAchievements(
  userId: string | null
): Promise<Array<{ id: string; name: string }>> {
  if (!userId) return [];

  const supabase = await createClient();
  const unlocked: Array<{ id: string; name: string }> = [];
  const userAchievementsWrite = supabase.from(
    'user_achievements'
  ) as unknown as UserAchievementsWriteTable;
  const profilesWrite = supabase.from('profiles') as unknown as ProfilesWriteTable;

  // Get user stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('quizzes_played, quizzes_created, points')
    .eq('id', userId)
    .single();

  if (!profile) return [];

  const profileData = profile as ProfileStats;

  // Check achievements
  const checks = [
    { id: 'first_quiz', condition: profileData.quizzes_played >= 1 },
    { id: 'quiz_addict_10', condition: profileData.quizzes_played >= 10 },
    { id: 'creator', condition: profileData.quizzes_created >= 1 },
  ];

  for (const check of checks) {
    if (check.condition) {
      // Check if already unlocked
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', check.id)
        .single();

      if (!existing) {
        // Get achievement details
        const { data: achievement } = await supabase
          .from('achievements')
          .select('name')
          .eq('id', check.id)
          .single();

        if (achievement) {
          const achievementInsert: AchievementInsert = {
            user_id: userId,
            achievement_id: check.id,
          };

          await userAchievementsWrite.insert(achievementInsert);

          const updatedPoints = profileData.points + 50;
          await profilesWrite.update({ points: updatedPoints }).eq('id', userId);

          profileData.points = updatedPoints;

          unlocked.push({ id: check.id, name: (achievement as { name: string }).name });
        }
      }
    }
  }

  return unlocked;
}

function slugifyTitle(title: string, language?: string): string {
  const normalizedTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72);

  const safeBase = normalizedTitle || 'quiz';
  const prefix = language === 'es' || language === 'en' ? `${language}-` : '';

  return `${prefix}${safeBase}`.slice(0, 80).replace(/^-|-$/g, '');
}

async function generateUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string,
  language?: string
): Promise<string> {
  const baseSlug = slugifyTitle(title, language);

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const candidate = `${baseSlug}${suffix}`.slice(0, 80).replace(/-+$/g, '');
    const { data } = await supabase
      .from('quizzes')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`.slice(0, 80).replace(/-+$/g, '');
}

export async function likeQuiz(quizId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const rpcClient = supabase as unknown as Pick<QuizRpcClient, 'rpcLike'>;

  const { data, error } = await rpcClient.rpcLike('toggle_like', {
    p_quiz_id: quizId,
    p_user_id: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/quiz/${quizId}`);

  return { success: true, liked: data };
}
