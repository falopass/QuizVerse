/**
 * Contract tests for POST /api/quiz/report.
 *
 * The endpoint is the only public route that writes quiz reports without a
 * session: it must cap payload size before parsing, throttle by IP (429 vs 503
 * on limiter outage), validate with Zod, verify the target quiz is published,
 * write via the service client (with SSR fallback), deduplicate anonymous
 * reports without PII, and fail closed when the insert errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ssrInsert: vi.fn(),
  serviceInsert: vi.fn(),
  quizLookup: vi.fn(),
  hasServiceClient: true,
  rateLimitCheck: vi.fn(),
}));

function makeDbClient(insertFn: typeof mocks.serviceInsert) {
  return {
    from: (table: string) => {
      if (table === 'quizzes') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: mocks.quizLookup,
        };
        return chain;
      }
      if (table === 'quiz_reports') {
        return { insert: insertFn };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    ...makeDbClient(mocks.ssrInsert),
  }),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => (mocks.hasServiceClient ? makeDbClient(mocks.serviceInsert) : null),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
}));

import { POST } from '@/app/api/quiz/report/route';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';
const validBody = { quiz_id: QUIZ_ID, reason: 'spam' };
const publishedQuiz = {
  id: QUIZ_ID,
  title: 'Space Trivia',
  slug: 'en-space-trivia',
  status: 'published',
};

function reportRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request('http://test/api/quiz/report', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  });
}

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.ssrInsert.mockReset();
  mocks.ssrInsert.mockResolvedValue({ error: null });
  mocks.serviceInsert.mockReset();
  mocks.serviceInsert.mockResolvedValue({ error: null });
  mocks.quizLookup.mockReset();
  mocks.quizLookup.mockResolvedValue({ data: publishedQuiz, error: null });
  mocks.hasServiceClient = true;
  mocks.rateLimitCheck.mockReset();
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 7, reset: 600 });
});

describe('POST /api/quiz/report — rate limit y tope de tamaño', () => {
  it('returns 429 when the limiter denies and never touches the database', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, remaining: 0, reset: 600 });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });

  it('returns 503 when the limiter backend fails closed', async () => {
    mocks.rateLimitCheck.mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: 600,
      errored: true,
    });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'rate_limiter_unavailable' });
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies with 413 before parsing or writing', async () => {
    const byHeader = await POST(reportRequest(validBody, { 'content-length': String(9 * 1024) }));
    expect(byHeader.status).toBe(413);
    expect(mocks.rateLimitCheck).not.toHaveBeenCalled();

    const byStream = await POST(
      reportRequest(JSON.stringify({ ...validBody, details: 'x'.repeat(9 * 1024) }))
    );
    expect(byStream.status).toBe(413);
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });

  it('limits on the first x-forwarded-for value, else x-real-ip, else unknown', async () => {
    await POST(reportRequest(validBody, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));
    expect(mocks.rateLimitCheck).toHaveBeenLastCalledWith('1.2.3.4');

    await POST(reportRequest(validBody, { 'x-real-ip': '9.9.9.9' }));
    expect(mocks.rateLimitCheck).toHaveBeenLastCalledWith('9.9.9.9');

    await POST(reportRequest(validBody));
    expect(mocks.rateLimitCheck).toHaveBeenLastCalledWith('unknown');
  });
});

describe('POST /api/quiz/report — validation and target check', () => {
  it('rejects a body that is not JSON', async () => {
    const response = await POST(reportRequest('esto no es json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });

  it('rejects a quiz_id that is not a UUID and a reason outside the enum', async () => {
    const badId = await POST(reportRequest({ ...validBody, quiz_id: 'no-uuid' }));
    expect(badId.status).toBe(400);
    expect(await badId.json()).toEqual({ error: 'invalid_payload' });

    const badReason = await POST(reportRequest({ ...validBody, reason: 'rude' }));
    expect(badReason.status).toBe(400);
    expect(await badReason.json()).toEqual({ error: 'invalid_payload' });

    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });

  it('returns 404 when the quiz does not exist or is not published', async () => {
    mocks.quizLookup.mockResolvedValue({ data: null, error: null });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'quiz_not_found' });
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/quiz/report — validated writer and deduplication', () => {
  it('stores an anonymous report with authoritative snapshot and SHA-256 fingerprint (no raw IP)', async () => {
    const response = await POST(reportRequest(validBody, { 'x-forwarded-for': '203.0.113.42' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.serviceInsert).toHaveBeenCalledWith({
      quiz_id: QUIZ_ID,
      quiz_title: 'Space Trivia',
      quiz_slug: 'en-space-trivia',
      reporter_id: null,
      reporter_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      reason: 'spam',
      details: null,
    });
    expect(JSON.stringify(mocks.serviceInsert.mock.calls)).not.toContain('203.0.113.42');
    expect(mocks.ssrInsert).not.toHaveBeenCalled();
  });

  it('falls back cleanly without reporter_fingerprint when migration 023 is not applied yet', async () => {
    mocks.serviceInsert
      .mockResolvedValueOnce({
        error: { code: 'PGRST204', message: "Could not find the 'reporter_fingerprint' column" },
      })
      .mockResolvedValueOnce({ error: null });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(200);
    expect(mocks.serviceInsert).toHaveBeenCalledTimes(2);
    expect(mocks.serviceInsert.mock.calls[1][0]).not.toHaveProperty('reporter_fingerprint');
  });

  it('falls back to SSR client when service role key is not configured', async () => {
    mocks.hasServiceClient = false;

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(200);
    expect(mocks.ssrInsert).toHaveBeenCalledOnce();
    expect(mocks.serviceInsert).not.toHaveBeenCalled();
  });

  it('stores the authenticated user id as reporter_id without fingerprint', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-42' } } });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(200);
    const payload = mocks.serviceInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.reporter_id).toBe('user-42');
    expect(payload.reporter_fingerprint).toBeUndefined();
  });

  it('returns 200 deduplicated on unique conflict (23505) for duplicate open report', async () => {
    mocks.serviceInsert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, deduplicated: true });
  });

  it('trims details and stores an empty details string as null', async () => {
    await POST(reportRequest({ ...validBody, details: '  bot farm  ' }));
    expect(mocks.serviceInsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ details: 'bot farm' })
    );

    await POST(reportRequest({ ...validBody, details: '' }));
    expect(mocks.serviceInsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ details: null })
    );
  });

  it('returns 500 and logs sanitized slug when the insert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.serviceInsert.mockResolvedValue({ error: { message: 'db down' } });

    const response = await POST(reportRequest({ ...validBody, quiz_slug: 'space-trivia' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'insert_failed' });
    expect(errorSpy).toHaveBeenCalledWith(
      'quiz-report-insert-failed',
      expect.objectContaining({ quizSlug: 'en-space-trivia', quizId: QUIZ_ID, reason: 'spam' })
    );
    errorSpy.mockRestore();
  });
});
