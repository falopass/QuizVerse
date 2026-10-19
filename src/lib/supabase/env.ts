/**
 * Supabase environment resolution.
 *
 * The client factories used to fall back to placeholder credentials silently,
 * which made a production deploy without env vars look alive while the catalog
 * and auth failed underneath. Placeholders are only allowed where a real
 * backend is never reached: a CI-only `next build` (NEXT_PHASE + CI, never
 * Vercel — its builds are deployable artifacts), dev and test.
 *
 * In the browser bundle, `NEXT_PUBLIC_*` and `NODE_ENV` are inlined at build
 * time; `NEXT_PHASE` is always undefined there, so a production client without
 * envs throws the same explicit error.
 */

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

export function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) return { url, anonKey };

  const isCiBuild =
    process.env.NEXT_PHASE === 'phase-production-build' &&
    process.env.CI === 'true' &&
    !process.env.VERCEL;
  if (process.env.NODE_ENV === 'production' && !isCiBuild) {
    const missing = [
      ...(!url ? ['NEXT_PUBLIC_SUPABASE_URL'] : []),
      ...(!anonKey
        ? ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY']
        : []),
    ].join(', ');
    throw new Error(`Missing required Supabase environment variables: ${missing}`);
  }

  return { url: url || PLACEHOLDER_URL, anonKey: anonKey || PLACEHOLDER_KEY };
}
