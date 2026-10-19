// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

vi.mock('@/lib/supabase/env', () => ({
  supabaseEnv: () => ({ url: 'https://test.supabase.co', anonKey: 'test-anon-key' }),
}));

const BASE = 'https://quizverse.org';

function req(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(`${BASE}${path}`), { headers });
}

describe('proxy — locale redirect', () => {
  it('redirects / to /es when Accept-Language prefers Spanish', async () => {
    const res = await proxy(req('/', { 'accept-language': 'es-CL,es;q=0.9' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/es`);
  });

  it('redirects / to /en when Accept-Language prefers English', async () => {
    const res = await proxy(req('/', { 'accept-language': 'en-US,en;q=0.9' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/en`);
  });

  it('redirects non-localized paths keeping the path', async () => {
    const res = await proxy(req('/quiz/foo', { 'accept-language': 'en' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/en/quiz/foo`);
  });

  it.each(['/es/quiz/foo', '/en/leaderboard'])(
    'passes %s through without redirect',
    async (path) => {
      const res = await proxy(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  );
});

describe('proxy — non-locale root routes', () => {
  it.each(['/covers/x.svg', '/manifest.json', '/robots.txt', '/sitemap.xml'])(
    'passes %s through without redirect',
    async (path) => {
      const res = await proxy(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  );

  // Activa cuando EMBED-01 mergee (añade '/embed' a NON_LOCALE_PREFIXES).
  it.skip('passes /embed/es/foo through without redirect', async () => {
    const res = await proxy(req('/embed/es/foo'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('proxy — Google Search Console verification', () => {
  it('serves google<token>.html before any redirect', async () => {
    const res = await proxy(req('/googleabc123def.html', { 'accept-language': 'es' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(await res.text()).toBe('google-site-verification: googleabc123def.html');
  });
});
