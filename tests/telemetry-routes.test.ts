/**
 * Contract tests for POST /api/analytics and POST /api/monitor.
 *
 * Both endpoints accept anonymous POSTs and write straight to the logs:
 * the Zod schema is what keeps a flood of oversized metadata out of them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimitCheck: vi.fn(),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
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
    const metadata = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v'])
    );
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
    const metadata = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v'])
    );
    const response = await monitorPOST(monitor({ message: 'boom', metadata }));

    expect(response.status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const response = await monitorPOST(monitor('no json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });
});
