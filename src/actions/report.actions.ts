'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const reportSchema = z.object({
  quiz_id: z.string().uuid(),
  reason: z.enum(['inappropriate', 'spam', 'incorrect_info', 'hate_speech', 'copyright', 'other']),
  details: z.string().max(500).optional(),
});

export async function reportQuiz(input: unknown) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const { error } = await (supabase as any).from('quiz_reports').insert({
    quiz_id: parsed.data.quiz_id,
    reporter_id: user?.id || null,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/quiz/${parsed.data.quiz_id}`);

  return { success: true };
}

export async function getQuizReports(quizId: string) {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from('quiz_reports')
    .select(
      `
      *,
      reporter:reporter_id (
        id,
        username,
        display_name
      )
    `
    )
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false });

  return reports || [];
}
