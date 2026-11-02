/**
 * Contract tests for POST /api/csp-report.
 *
 * The Content-Security-Policy-Report-Only header points its `report-uri` here.
 * The route must accept both browser formats (legacy `application/csp-report`
 * and the Reporting API `application/reports+json`), cap the payload, throttle
 * by IP and log a summary without personal data (no document URL: it can carry
 * share tokens in the query).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimitCheck: vi.fn(),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
}));

import { POST } from '@/app/api/csp-report/route';

function cspRequest(
  body: string,
  contentType = 'application/csp-report',
  headers?: Record<string, string>
): Request {
  return new Request('http://test/api/csp-report', {
    method: 'POST',
    body,
    headers: { 'content-type': contentType, ...headers },
  });
}

const legacyReport = JSON.stringify({
  'csp-report': {
    'document-uri': 'https://quizverse.org/es/quiz/x/result?s=0123456789abcdef',
    'violated-directive': 'img-src',
    'effective-directive': 'img-src',
    'blocked-uri': 'https://tracker.example.com/pixel.png',
    'source-file': 'https://quizverse.org/_next/static/chunk.js',
    disposition: 'report',
  },
});

const reportsJson = JSON.stringify([
  {
    type: 'csp-violation',
    url: 'https://quizverse.org/en',
    body: {
      effectiveDirective: 'script-src',
      blockedURL: 'inline',
      sourceFile: 'https://quizverse.org/en',
      documentURL: 'https://quizverse.org/en/result?s=abcdef0123456789',
    },
  },
]);

beforeEach(() => {
  mocks.rateLimitCheck.mockReset().mockResolvedValue({ allowed: true });
});

describe('POST /api/csp-report — admission', () => {
  it('rejects an unsupported content type', async () => {
    const response = await POST(cspRequest('{}', 'application/json'));

    expect(response.status).toBe(415);
  });

  it('rejects a body over the size cap by declared content-length', async () => {
    const response = await POST(
      cspRequest('{}', 'application/csp-report', { 'content-length': String(9 * 1024) })
    );

    expect(response.status).toBe(413);
    expect(mocks.rateLimitCheck).not.toHaveBeenCalled();
  });

  it('rejects a body over the size cap without content-length', async () => {
    const response = await POST(cspRequest('x'.repeat(9 * 1024)));

    expect(response.status).toBe(413);
  });

  it('rejects invalid JSON', async () => {
    const response = await POST(cspRequest('not json at all'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });

  it('rejects JSON that is not a report', async () => {
    const response = await POST(cspRequest('{"hello":"world"}'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
  });

  it('returns 429 when the limiter denies', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false });

    const response = await POST(cspRequest(legacyReport));

    expect(response.status).toBe(429);
  });
});

describe('POST /api/csp-report — summaries', () => {
  it('accepts the legacy application/csp-report format and logs a summary', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(cspRequest(legacyReport));

    expect(response.status).toBe(204);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged.channel).toBe('csp-report');
    expect(logged.reports).toEqual([
      {
        directive: 'img-src',
        blockedHost: 'tracker.example.com',
        sourceHost: 'quizverse.org',
        disposition: 'report',
      },
    ]);
    // El document-uri nunca se registra: su query puede llevar tokens.
    expect(warnSpy.mock.calls[0][0]).not.toContain('0123456789abcdef');
    expect(warnSpy.mock.calls[0][0]).not.toContain('document-uri');
    warnSpy.mockRestore();
  });

  it('accepts the application/reports+json array format with camelCase keys', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(cspRequest(reportsJson, 'application/reports+json'));

    expect(response.status).toBe(204);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged.reports).toEqual([
      {
        directive: 'script-src',
        blockedHost: 'inline',
        sourceHost: 'quizverse.org',
        disposition: null,
      },
    ]);
    expect(warnSpy.mock.calls[0][0]).not.toContain('abcdef0123456789');
    warnSpy.mockRestore();
  });

  it('never logs free-form text planted in the report fields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hostile = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://quizverse.org/?s=deadbeefdeadbeef',
        'effective-directive': 'img-src https://evil.example/leak?token=secret',
        'blocked-uri': 'https://user:password@internal.example/x?jwt=abc',
        disposition: 'report); DROP TABLE logs;--',
      },
    });

    const response = await POST(cspRequest(hostile));

    expect(response.status).toBe(204);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    // La directiva con espacios no es un token válido: se descarta entera.
    expect(logged.reports[0].directive).toBeNull();
    expect(logged.reports[0].disposition).toBeNull();
    // Del URI solo sobrevive el host, nunca credenciales ni query.
    expect(logged.reports[0].blockedHost).toBe('internal.example');
    expect(warnSpy.mock.calls[0][0]).not.toContain('password');
    expect(warnSpy.mock.calls[0][0]).not.toContain('jwt');
    expect(warnSpy.mock.calls[0][0]).not.toContain('deadbeefdeadbeef');
    warnSpy.mockRestore();
  });
});
