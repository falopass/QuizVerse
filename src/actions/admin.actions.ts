'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import type { Database } from '@/types/database';

type QuizUpdate = Database['public']['Tables']['quizzes']['Update'];
type QuizReportUpdate = Database['public']['Tables']['quiz_reports']['Update'];

export async function getAdminDashboardStats() {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: totalQuizzes },
    { count: pendingQuizzes },
    { count: reports },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('quizzes').select('*', { count: 'exact', head: true }),
    supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('quiz_reports').select('*', { count: 'exact', head: true }).eq('resolved', false),
  ]);

  const { data: recentQuizzes } = await supabase
    .from('quizzes')
    .select(
      `
      *,
      creator:creator_id (
        username,
        display_name
      ),
      category:category_id (
        name
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    stats: {
      total_users: totalUsers || 0,
      total_quizzes: totalQuizzes || 0,
      pending_quizzes: pendingQuizzes || 0,
      pending_reports: reports || 0,
    },
    recent_quizzes: recentQuizzes || [],
  };
}

export async function approveQuiz(quizId: string) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const supabase = await createClient();

  const updateData = {
    status: 'published' as const,
    published_at: new Date().toISOString(),
  } satisfies Partial<QuizUpdate>;

  // @ts-expect-error Supabase Update type is strict; partial updates are valid at runtime
  const { error } = await supabase.from('quizzes').update(updateData).eq('id', quizId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/quizzes');
  revalidatePath('/quiz');

  return { success: true };
}

export async function rejectQuiz(quizId: string) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const supabase = await createClient();

  const updateData = { status: 'rejected' as const } satisfies Partial<QuizUpdate>;

  // @ts-expect-error Supabase Update type is strict; partial updates are valid at runtime
  const { error } = await supabase.from('quizzes').update(updateData).eq('id', quizId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/quizzes');

  return { success: true };
}

export async function banUser(userId: string) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const supabase = await createClient();

  const updateData = { status: 'archived' as const } satisfies Partial<QuizUpdate>;

  // @ts-expect-error Supabase Update type is strict; partial updates are valid at runtime
  await supabase.from('quizzes').update(updateData).eq('creator_id', userId);

  revalidatePath('/admin');

  return { success: true };
}

export async function getPendingQuizzes() {
  const supabase = await createClient();

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select(
      `
      *,
      creator:creator_id (
        username,
        display_name
      ),
      category:category_id (
        name
      )
    `
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return quizzes || [];
}

export async function getReports() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from('quiz_reports')
    .select(
      `
      *,
      quiz:quiz_id (
        id,
        title,
        slug
      ),
      reporter:reporter_id (
        username,
        display_name
      )
    `
    )
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  return reports || [];
}

export async function resolveReport(reportId: string) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return { error: adminCheck.error };

  const supabase = await createClient();

  const updateData = {
    resolved: true,
    resolved_by: adminCheck.userId,
    resolved_at: new Date().toISOString(),
  } satisfies Partial<QuizReportUpdate>;

  // @ts-expect-error Supabase Update type is strict; partial updates are valid at runtime
  const { error } = await supabase.from('quiz_reports').update(updateData).eq('id', reportId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/reports');

  return { success: true };
}
