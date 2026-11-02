import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function loadConfig() {
  vi.resetModules();
  const mod = (await import('../next.config')).default;
  const rules = (await mod.headers!()) as HeaderRule[];
  const redirects = await mod.redirects!();
  return { rules, redirects };
}

function headerValue(rule: HeaderRule, key: string) {
  return rule.headers.find((h) => h.key === key)?.value;
}

afterEach(() => vi.unstubAllEnvs());

describe('next.config headers()', () => {
  it('emits Content-Security-Policy-Report-Only on normal routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    const { rules } = await loadConfig();
    const normal = rules[0];

    const csp = headerValue(normal, 'Content-Security-Policy-Report-Only');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("frame-ancestors 'none'");
    // Report-only: nunca la versión que bloquea.
    expect(headerValue(normal, 'Content-Security-Policy')).toBeUndefined();
    expect(headerValue(normal, 'X-Frame-Options')).toBe('DENY');
  });

  it('uses the real Supabase origin in connect-src when the env is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://real.supabase.co');
    const { rules } = await loadConfig();

    expect(headerValue(rules[0], 'Content-Security-Policy-Report-Only')).toContain(
      "connect-src 'self' https://real.supabase.co"
    );
  });

  it('keeps /embed framable: CSP without frame-ancestors, no X-Frame-Options', async () => {
    const { rules } = await loadConfig();
    const embedRules = rules.filter((r) => r.source.startsWith('/embed/'));
    expect(embedRules).toHaveLength(2);

    for (const rule of embedRules) {
      const csp = headerValue(rule, 'Content-Security-Policy-Report-Only');
      expect(csp).toBeDefined();
      expect(csp).not.toContain('frame-ancestors');
      expect(headerValue(rule, 'X-Frame-Options')).toBeUndefined();
    }
  });

  it('does not cache public assets from the Worker (rules live in _headers)', async () => {
    const { rules } = await loadConfig();
    const sources = rules.map((r) => r.source);

    for (const asset of ['/icons/:path*', '/og/:path*', '/favicon.ico']) {
      expect(sources).not.toContain(asset);
    }
  });

  it('adds X-Robots-Tag noindex on Workers Builds previews', async () => {
    vi.stubEnv('WORKERS_CI_BRANCH', 'fix/headers-csp');
    const { rules } = await loadConfig();
    const preview = rules.find((r) => headerValue(r, 'X-Robots-Tag'));

    expect(preview).toBeDefined();
    expect(headerValue(preview!, 'X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('does not emit X-Robots-Tag on main builds', async () => {
    vi.stubEnv('WORKERS_CI_BRANCH', 'main');
    const { rules } = await loadConfig();

    expect(rules.find((r) => headerValue(r, 'X-Robots-Tag'))).toBeUndefined();
  });
});

describe('next.config redirects()', () => {
  it('308-redirects legacy /{locale}/explore to /{locale}/quiz', async () => {
    const { redirects } = await loadConfig();

    expect(redirects).toEqual([
      { source: '/en/explore', destination: '/en/quiz', permanent: true },
      { source: '/es/explore', destination: '/es/quiz', permanent: true },
      { source: '/feed.xml', destination: '/en/feed.xml', permanent: true },
    ]);
  });
});

describe('public/_headers (Cloudflare assets layer)', () => {
  const file = readFileSync('public/_headers', 'utf8');

  it.each([
    ['/_next/static/*', 'public,max-age=31536000,immutable'],
    ['/icons/*', 'public,max-age=604800,immutable'],
    ['/og/*', 'public,max-age=604800,immutable'],
    ['/favicon.ico', 'public,max-age=604800'],
  ])('caches %s with %s', (path, cacheControl) => {
    const section = file.split(/\n\s*\n/).find((block) => block.startsWith(`${path}\n`));
    expect(section).toBeDefined();
    expect(section).toContain(`Cache-Control: ${cacheControl}`);
  });

  it('sets nosniff on every static asset', () => {
    const all = file.split(/\n\s*\n/).find((block) => block.startsWith('/*\n'));
    expect(all).toContain('X-Content-Type-Options: nosniff');
  });
});
