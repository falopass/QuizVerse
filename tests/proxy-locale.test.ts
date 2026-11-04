// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { proxy } from '@/proxy';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock('@/lib/supabase/env', () => ({
  supabaseEnv: () => ({ url: 'https://test.supabase.co', anonKey: 'test-anon-key' }),
}));

const BASE = 'https://quizverse.org';

function req(path: string, headers?: Record<string, string>, method = 'GET', base = BASE) {
  return new NextRequest(new URL(`${base}${path}`), { headers, method });
}

beforeEach(() => {
  mocks.getUser.mockClear();
});

describe('proxy — locale redirect', () => {
  it('redirects / to /es when Accept-Language prefers Spanish', async () => {
    const res = await proxy(req('/', { 'accept-language': 'es-CL,es;q=0.9' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/es`);
    expect(res.headers.get('vary')).toBe('Accept-Language');
  });

  it('redirects / to /en when Accept-Language prefers English', async () => {
    const res = await proxy(req('/', { 'accept-language': 'en-US,en;q=0.9' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/en`);
    expect(res.headers.get('vary')).toBe('Accept-Language');
  });

  it('does not match ca-ES as Spanish and skips unknown first tags', async () => {
    const ca = await proxy(req('/', { 'accept-language': 'ca-ES,en;q=0.9' }));
    expect(ca.headers.get('location')).toBe(`${BASE}/en`);

    const fr = await proxy(req('/', { 'accept-language': 'fr-CA,es;q=0.9' }));
    expect(fr.headers.get('location')).toBe(`${BASE}/es`);
  });

  it('honors q values: q=0 is unacceptable and higher q wins over position', async () => {
    const rejected = await proxy(req('/', { 'accept-language': 'es;q=0,en;q=1' }));
    expect(rejected.headers.get('location')).toBe(`${BASE}/en`);

    const higher = await proxy(req('/', { 'accept-language': 'es;q=0.5,en;q=0.9' }));
    expect(higher.headers.get('location')).toBe(`${BASE}/en`);
  });

  it('redirects non-localized paths permanently keeping the path', async () => {
    const res = await proxy(req('/quiz/foo', { 'accept-language': 'en' }));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${BASE}/en/quiz/foo`);
    expect(res.headers.get('vary')).toBe('Accept-Language');
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

describe('proxy — session refresh', () => {
  it('skips getUser() when there is no Supabase auth cookie', async () => {
    await proxy(req('/en'));
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each(['sb-project-auth-token=abc', 'sb-project-auth-token.0=abc', 'sb-api-auth-token.1=x'])(
    'calls getUser() with session cookie %s',
    async (cookie) => {
      await proxy(req('/en', { cookie }));
      expect(mocks.getUser).toHaveBeenCalledTimes(1);
    }
  );

  it('no responde 500 si el SDK lanza con una cookie de sesión corrupta', async () => {
    mocks.getUser.mockRejectedValueOnce(new Error('Invalid UTF-8 sequence'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await proxy(req('/en', { cookie: 'sb-project-auth-token=base64-roto' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
    warn.mockRestore();
  });

  it('does not treat a lone PKCE code-verifier cookie as a session', async () => {
    await proxy(req('/en', { cookie: 'sb-project-auth-token-code-verifier=xyz' }));
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});

describe('proxy — public HTML cache policy', () => {
  it.each([
    '/en',
    '/es',
    '/es/quiz',
    '/en/quiz/foo',
    '/es/fandom/frieren',
    '/en/indice',
    '/es/novedades',
    '/es/about',
    '/en/faq',
    '/es/privacy',
    '/en/terms',
    '/es/contact',
  ])('leaves Next/OpenNext in control of anonymous %s', async (path) => {
    const res = await proxy(req(path));
    expect(res.headers.get('cache-control')).toBeNull();
    expect(res.headers.get('vary')).toBeNull();
  });

  it('preserves an existing cache policy and Vary', async () => {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    response.headers.set('Vary', 'RSC, Next-Router-State-Tree');
    const next = vi.spyOn(NextResponse, 'next').mockReturnValueOnce(response);
    try {
      const res = await proxy(req('/es'));
      expect(res.headers.get('cache-control')).toBe('s-maxage=300, stale-while-revalidate=86400');
      expect(res.headers.get('vary')).toBe('RSC, Next-Router-State-Tree');
    } finally {
      next.mockRestore();
    }
  });

  it('makes even an invalid session cookie private', async () => {
    const res = await proxy(req('/en/quiz/foo', { cookie: 'sb-x-auth-token=abc' }));
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it.each([
    '/es/me',
    '/en/settings',
    '/es/my-quizzes',
    '/en/create',
    '/es/create/ai',
    '/en/notifications',
    '/es/admin/moderacion',
    '/en/login',
    '/es/register',
    '/en/quiz/foo/play',
    '/es/quiz/foo/result',
    '/es/category/trivia?page=2',
    '/en/leaderboard',
    '/es/fandom',
    '/es/fandom/frieren/extra',
    '/es/no-existe',
  ])('keeps dynamic/unknown %s private even without a session', async (path) => {
    const res = await proxy(req(path));
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
  });

  it.each([
    '/en/feed.xml',
    '/api/stats',
    '/covers/x.svg',
    '/callback',
    '/en/opengraph-image',
    '/en/quiz/x/opengraph-image',
  ])('does not relax %s', async (path) => {
    const res = await proxy(req(path));
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it('does not relax non-GET requests', async () => {
    const res = await proxy(req('/en/quiz/foo', undefined, 'POST'));
    expect(res.headers.get('cache-control')).toBeNull();
  });
});

describe('proxy — HTTPS upgrade', () => {
  const HTTP_BASE = 'http://quizverse.org';

  it('redirects http to https preserving path and query', async () => {
    const res = await proxy(
      req('/quiz/foo?x=1', { 'x-forwarded-proto': 'http' }, 'GET', HTTP_BASE)
    );
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${BASE}/quiz/foo?x=1`);
  });

  it('redirects when cf-visitor reports http', async () => {
    const res = await proxy(req('/en', { 'cf-visitor': '{"scheme":"http"}' }, 'GET', HTTP_BASE));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${BASE}/en`);
  });

  it('trusts cf-visitor over x-forwarded-proto', async () => {
    const res = await proxy(
      req(
        '/en',
        { 'cf-visitor': '{"scheme":"https"}', 'x-forwarded-proto': 'http' },
        'GET',
        HTTP_BASE
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not loop when the URL is already https but headers claim http', async () => {
    const res = await proxy(req('/en', { 'x-forwarded-proto': 'http' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not redirect when no scheme header is present', async () => {
    const res = await proxy(req('/en'));
    expect(res.status).toBe(200);
  });
});

describe('proxy — non-locale root routes', () => {
  it('redirects /opengraph-image to the localized card', async () => {
    const res = await proxy(req('/opengraph-image', { 'accept-language': 'es' }));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${BASE}/es/opengraph-image`);
  });

  it.each(['/covers/x.svg', '/callback'])('passes %s through without redirect', async (path) => {
    const res = await proxy(req(path));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  // Estas rutas con extensión ya no llegan al proxy en producción: el `matcher`
  // las excluye antes. Si llegaran, redirect a la versión con locale.
  it.each([
    '/manifest.json',
    '/robots.txt',
    '/sitemap.xml',
    '/favicon.ico',
    '/sw.js',
    '/icon.png',
    '/apple-icon.png',
  ])('redirects %s to the localized path', async (path) => {
    const res = await proxy(req(path, { 'accept-language': 'en' }));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${BASE}/en${path}`);
  });

  it('passes /embed/es/foo through without redirect', async () => {
    const res = await proxy(req('/embed/es/foo'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('passes POST /api/auth/send-email (hook de GoTrue) without redirect', async () => {
    const res = await proxy(req('/api/auth/send-email', undefined, 'POST'));
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
