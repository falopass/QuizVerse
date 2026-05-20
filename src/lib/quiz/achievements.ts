import { createClient } from '@/lib/supabase/server';

interface ProfileStats {
  points: number;
  quizzes_played: number;
  quizzes_created: number;
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
    if (check.condition) {
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', check.id)
        .single();

      if (!existing) {
        const { data: achievement } = await supabase
          .from('achievements')
          .select('name')
          .eq('id', check.id)
          .single();

        if (achievement) {
          await supabase.from('user_achievements').insert({
            user_id: userId,
            achievement_id: check.id,
          } as never);

          const updatedPoints = profileData.points + 50;
          await supabase
            .from('profiles')
            .update({ points: updatedPoints } as never)
            .eq('id', userId);

          profileData.points = updatedPoints;

          const name = (achievement as { name: string }).name;
          unlocked.push({ id: check.id, name });
        }
      }
    }
  }

  return unlocked;
}
