'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface Profile {
  is_admin: boolean;
}

export async function getAdminDashboardStats() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile || !(profile as Profile).is_admin) {
    return { error: 'Not authorized' };
  }

  // Get stats
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

  // Recent quizzes
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const { error } = await (supabase as any)
    .from('quizzes')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', quizId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/quizzes');
  revalidatePath('/quiz');

  return { success: true };
}

export async function rejectQuiz(quizId: string, reason: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const { error } = await (supabase as any)
    .from('quizzes')
    .update({ status: 'rejected' })
    .eq('id', quizId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/quizzes');

  return { success: true };
}

export async function banUser(userId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  // Archive all quizzes by user
  await (supabase as any).from('quizzes').update({ status: 'archived' }).eq('creator_id', userId);

  // In a real app, you'd also suspend the auth user
  // This requires admin privileges

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

export async function resolveReport(reportId: string, resolvedBy: string) {
  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from('quiz_reports')
    .update({
      resolved: true,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/reports');

  return { success: true };
}
