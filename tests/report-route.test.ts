/**
 * Contract tests for POST /api/quiz/report.
 *
 * The endpoint is the only public route that writes to the database without a
 * session: it must throttle by IP, validate with Zod, attach the reporter when
 * logged in, and fail closed when the insert errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  rateLimitCheck: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table !== 'quiz_reports') throw new Error(`unexpected table ${table}`);
      return { insert: mocks.insert };
    },
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
}));

import { POST } from '@/app/api/quiz/report/route';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';
const validBody = { quiz_id: QUIZ_ID, reason: 'spam' };

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
  mocks.insert.mockReset();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.rateLimitCheck.mockReset();
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 7, reset: 600 });
});

describe('POST /api/quiz/report — rate limit', () => {
  it('returns 429 when the limiter denies and never touches the database', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, remaining: 0, reset: 600 });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(mocks.insert).not.toHaveBeenCalled();
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

describe('POST /api/quiz/report — validation', () => {
  it('rejects a body that is not JSON', async () => {
    const response = await POST(reportRequest('esto no es json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects a quiz_id that is not a UUID and a reason outside the enum', async () => {
    const badId = await POST(reportRequest({ ...validBody, quiz_id: 'no-uuid' }));
    expect(badId.status).toBe(400);
    expect(await badId.json()).toEqual({ error: 'invalid_payload' });

    const badReason = await POST(reportRequest({ ...validBody, reason: 'rude' }));
    expect(badReason.status).toBe(400);
    expect(await badReason.json()).toEqual({ error: 'invalid_payload' });

    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('POST /api/quiz/report — insert', () => {
  it('stores an anonymous report with reporter_id null', async () => {
    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.insert).toHaveBeenCalledWith({
      quiz_id: QUIZ_ID,
      reporter_id: null,
      reason: 'spam',
      details: null,
    });
  });

  it('stores the authenticated user id as reporter_id', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-42' } } });

    const response = await POST(reportRequest(validBody));

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: 'user-42' }));
  });

  it('trims details and stores an empty details string as null', async () => {
    await POST(reportRequest({ ...validBody, details: '  bot farm  ' }));
    expect(mocks.insert).toHaveBeenLastCalledWith(expect.objectContaining({ details: 'bot farm' }));

    await POST(reportRequest({ ...validBody, details: '' }));
    expect(mocks.insert).toHaveBeenLastCalledWith(expect.objectContaining({ details: null }));
  });

  it('returns 500 and logs when the insert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.insert.mockResolvedValue({ error: { message: 'db down' } });

    const response = await POST(reportRequest({ ...validBody, quiz_slug: 'space-trivia' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'insert_failed' });
    expect(errorSpy).toHaveBeenCalledWith(
      'quiz-report-insert-failed',
      expect.objectContaining({ quizSlug: 'space-trivia', quizId: QUIZ_ID, reason: 'spam' })
    );
    errorSpy.mockRestore();
  });
});
