import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

interface ProfileStats {
  points: number;
  quizzes_played: number;
  quizzes_created: number;
}

type AchievementInsert = Database['public']['Tables']['user_achievements']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface UserAchievementsWriteTable {
  insert: (
    values: AchievementInsert,
    options?: { onConflict?: string }
  ) => Promise<{ error: { message: string } | null }>;
}

interface ProfilesWriteTable {
  update: (values: ProfileUpdate) => {
    eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
  };
}

export async function checkAchievements(
  userId: string | null
): Promise<Array<{ id: string; name: string }>> {
  if (!userId) return [];

  const supabase = await createClient();
  const unlocked: Array<{ id: string; name: string }> = [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('quizzes_played, quizzes_created, points')
    .eq('id', userId)
    .single();

  if (!profile) return [];

  const profileData: ProfileStats = profile;

  const checks = [
    { id: 'first_quiz', condition: profileData.quizzes_played >= 1 },
    { id: 'quiz_addict_10', condition: profileData.quizzes_played >= 10 },
    { id: 'creator', condition: profileData.quizzes_created >= 1 },
  ];

  for (const check of checks) {
    if (!check.condition) continue;

    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', check.id)
      .maybeSingle();

    if (existing) continue;

    const { data: achievement } = await supabase
      .from('achievements')
      .select('name')
      .eq('id', check.id)
      .single();

    if (!achievement) continue;

    const userAchievementsWrite = supabase.from(
      'user_achievements'
    ) as unknown as UserAchievementsWriteTable;

    const { error: insertError } = await userAchievementsWrite.insert(
      {
        user_id: userId,
        achievement_id: check.id,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, achievement_id' }
    );

    if (insertError) continue;

    const updatedPoints = profileData.points + 50;
    const profilesWrite = supabase.from('profiles') as unknown as ProfilesWriteTable;
    await profilesWrite.update({ points: updatedPoints }).eq('id', userId);

    profileData.points = updatedPoints;

    const name = (achievement as { name: string }).name;
    unlocked.push({ id: check.id, name });
  }

  return unlocked;
}
