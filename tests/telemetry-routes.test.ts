/**
 * Contract tests for POST /api/analytics and POST /api/monitor.
 *
 * Both endpoints accept anonymous POSTs and write straight to the logs:
 * the Zod schema is what keeps a flood of oversized metadata out of them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimitCheck: vi.fn(),
  insert: vi.fn(),
  hasServiceKey: true,
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () =>
    mocks.hasServiceKey ? { from: () => ({ insert: mocks.insert }) } : null,
}));

import { POST as analyticsPOST } from '@/app/api/analytics/route';
import { POST as monitorPOST } from '@/app/api/monitor/route';

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const analytics = (body: unknown) => post('http://test/api/analytics', body);
const monitor = (body: unknown) => post('http://test/api/monitor', body);

beforeEach(() => {
  mocks.rateLimitCheck.mockReset();
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 99, reset: 60 });
  mocks.insert.mockReset();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.hasServiceKey = true;
});

describe('POST /api/analytics', () => {
  it('accepts a valid event', async () => {
    const response = await analyticsPOST(
      analytics({ name: 'page_view', locale: 'es', path: '/es/home' })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('rejects an unknown event name', async () => {
    const response = await analyticsPOST(analytics({ name: 'not_an_event' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rejects metadata with more than 10 keys', async () => {
    const metadata = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v']));
    const response = await analyticsPOST(analytics({ name: 'page_view', metadata }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rejects a metadata value that is too long', async () => {
    const response = await analyticsPOST(
      analytics({ name: 'page_view', metadata: { k: 'x'.repeat(5000) } })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rejects a non-finite value', async () => {
    const response = await analyticsPOST(analytics({ name: 'page_view', value: NaN }));

    expect(response.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, remaining: 0, reset: 60 });

    const response = await analyticsPOST(analytics({ name: 'page_view' }));

    expect(response.status).toBe(429);
  });

  it('persists a whitelisted event with no PII: query string and tokens are dropped from the path', async () => {
    const response = await analyticsPOST(
      analytics({
        name: 'share_click',
        locale: 'es',
        // Los shares mandan URL absolutas: solo queda el pathname.
        path: 'https://quizverse.org/es/quiz/x?via=whatsapp&s=secret-token#frag',
        source: 'whatsapp',
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith({
      name: 'share_click',
      locale: 'es',
      path: '/es/quiz/x',
      quiz_slug: null,
      source: 'whatsapp',
      value: null,
    });
    const stored = JSON.stringify(mocks.insert.mock.calls.map((call) => call[0]));
    expect(stored).not.toMatch(/secret-token|\?|#/);
  });

  it('stores null for a hostile via channel instead of the raw value', async () => {
    const response = await analyticsPOST(
      analytics({
        name: 'invite_landing',
        path: '/es/quiz/x?via=correo%40evil.com',
        metadata: { kind: 'via', channel: 'correo@evil.com' },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'invite_landing', source: null })
    );
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain('evil.com');
  });

  it('does not persist events outside the whitelist', async () => {
    for (const name of ['locale_switch', 'create_start', 'client_error', 'web_vitals']) {
      const response = await analyticsPOST(analytics({ name }));
      expect(response.status).toBe(200);
    }

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('folds invite_landing kind:channel into source and quiz attribution into quiz_complete', async () => {
    await analyticsPOST(
      analytics({
        name: 'invite_landing',
        path: '/es/quiz/x?g=abc',
        metadata: { kind: 'invite', channel: 'g' },
      })
    );
    await analyticsPOST(
      analytics({
        name: 'quiz_complete',
        quizSlug: 'es-quiz-x',
        value: 35,
        metadata: { answers: 10, shareVia: 'invite:g' },
      })
    );

    expect(mocks.insert).toHaveBeenNthCalledWith(1, {
      name: 'invite_landing',
      locale: null,
      path: '/es/quiz/x',
      quiz_slug: null,
      source: 'invite:g',
      value: null,
    });
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      name: 'quiz_complete',
      locale: null,
      path: null,
      quiz_slug: 'es-quiz-x',
      source: 'invite:g',
      value: 35,
    });
  });

  it('still returns success when the insert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.insert.mockResolvedValue({ error: { code: '42501', message: 'denied' } });

    const response = await analyticsPOST(analytics({ name: 'page_view', path: '/es' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    errorSpy.mockRestore();
  });

  it('still returns success when the table is missing (migration not applied)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.insert.mockResolvedValue({
      error: { code: 'PGRST205', message: 'Could not find the table' },
    });

    const response = await analyticsPOST(analytics({ name: 'page_view', path: '/es' }));

    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('responds without persisting when there is no service key', async () => {
    mocks.hasServiceKey = false;

    const response = await analyticsPOST(analytics({ name: 'page_view', path: '/es' }));

    expect(response.status).toBe(200);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('POST /api/monitor', () => {
  it('accepts a valid error report', async () => {
    const response = await monitorPOST(
      monitor({ message: 'boom', path: '/es/quiz/x', source: 'error-boundary' })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('rejects an empty message', async () => {
    const response = await monitorPOST(monitor({ message: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rejects metadata over the cap', async () => {
    const metadata = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v']));
    const response = await monitorPOST(monitor({ message: 'boom', metadata }));

    expect(response.status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const response = await monitorPOST(monitor('no json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });
});
