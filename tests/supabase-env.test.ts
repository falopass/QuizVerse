import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseEnv } from '@/lib/supabase/env';

const ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PHASE',
  'NODE_ENV',
  'CI',
  'VERCEL',
] as const;

function clearSupabaseEnv() {
  for (const name of ENV_VARS) {
    vi.stubEnv(name, undefined);
  }
}

beforeEach(clearSupabaseEnv);
afterEach(() => vi.unstubAllEnvs());

describe('supabaseEnv', () => {
  it('returns the configured url and publishable key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://real.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'sb_publishable_x');

    expect(supabaseEnv()).toEqual({ url: 'https://real.supabase.co', anonKey: 'sb_publishable_x' });
  });

  it('falls back to the legacy anon key and prefers the publishable one', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://real.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    expect(supabaseEnv().anonKey).toBe('anon-key');

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'publishable-key');
    expect(supabaseEnv().anonKey).toBe('publishable-key');
  });

  it('throws explicitly in production runtime without envs', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => supabaseEnv()).toThrow(
      'Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });

  it('throws in production runtime when only one env is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://real.supabase.co');

    expect(() => supabaseEnv()).toThrow('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  });

  it('returns placeholders during a CI-only next build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('CI', 'true');

    expect(supabaseEnv()).toEqual({
      url: 'https://placeholder.supabase.co',
      anonKey: 'placeholder-key',
    });
  });

  it('throws during a production build outside CI (deployable artifact)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');

    expect(() => supabaseEnv()).toThrow('Missing required Supabase environment variables');
  });

  it('throws during a Vercel build even when CI is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('CI', 'true');
    vi.stubEnv('VERCEL', '1');

    expect(() => supabaseEnv()).toThrow('Missing required Supabase environment variables');
  });

  it.each(['test', 'development'])('returns placeholders when NODE_ENV=%s', (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv);

    expect(supabaseEnv()).toEqual({
      url: 'https://placeholder.supabase.co',
      anonKey: 'placeholder-key',
    });
  });
});

describe('next.config Vercel guard', () => {
  it('fails the build on Vercel without Supabase envs', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.resetModules();

    await expect(import('../next.config')).rejects.toThrow(
      'Missing required Supabase environment variables'
    );
  });

  it('loads next.config outside Vercel without Supabase envs', async () => {
    vi.resetModules();

    await expect(import('../next.config')).resolves.toBeDefined();
  });
});
