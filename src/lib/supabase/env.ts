export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'dummy-anon-key';

  if (!url || !anonKey) {
    console.warn('Supabase environment variables missing, using fallback values');
    return { url: 'https://dummy.supabase.co', anonKey: 'dummy-anon-key' };
  }

  return { url, anonKey };
}
