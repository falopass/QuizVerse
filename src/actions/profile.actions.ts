'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProfileSchema = z.object({
  display_name: z.string().min(2).max(50).optional(),
  bio: z.string().max(280).optional(),
  username: z.string().regex(/^[a-z0-9_]{3,24}$/).optional(),
});

export async function updateProfile(input: unknown) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  // Check if username is taken
  if (parsed.data.username) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', parsed.data.username)
      .neq('id', user.id)
      .single();

    if (existing) {
      return { error: 'Username already taken' };
    }
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update(parsed.data)
    .eq('id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/profile/${parsed.data.username || user.id}`);
  revalidatePath('/profile/settings');

  return { success: true };
}

export async function getUserProfile(username: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (!profile) {
    return null;
  }

  return profile;
}

export async function getProfileQuizzes(userId: string) {
  const supabase = await createClient();

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('*')
    .eq('creator_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  return quizzes || [];
}

export async function getProfileStats(userId: string) {
  const supabase = await createClient();

  // Get achievements
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select(`
      *,
      achievement:achievements (*)
    `)
    .eq('user_id', userId);

  // Get game sessions count
  const { count: gamesPlayed } = await supabase
    .from('game_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', userId);

  return {
    achievements: achievements || [],
    games_played: gamesPlayed || 0,
  };
}
