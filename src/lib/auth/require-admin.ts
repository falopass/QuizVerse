import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function requireAdmin(): Promise<{ error: string } | { userId: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.warn('Admin access denied: not authenticated');
    return { error: 'Unauthorized' };
  }

  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();

  const profile = data as { is_admin: boolean } | null;

  if (!profile?.is_admin) {
    logger.warn('Admin access denied: not admin', { userId: user.id });
    return { error: 'Not authorized' };
  }

  return { userId: user.id };
}
