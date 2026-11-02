/**
 * Contract test for POST /api/locale: the language cookie is only read on the
 * server, so it must go out HttpOnly + SameSite=Lax (Secure in production).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ update: () => ({ eq: async () => ({}) }) }),
  }),
}));

import { POST } from '@/app/api/locale/route';

function localeRequest(locale: string): Request {
  return new Request('http://test/api/locale', {
    method: 'POST',
    body: JSON.stringify({ locale }),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  mocks.cookieSet.mockClear();
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
});

describe('POST /api/locale', () => {
  it('sets the locale cookie HttpOnly and SameSite=Lax', async () => {
    const response = await POST(localeRequest('es'));

    expect(response.status).toBe(200);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'quizverse-locale',
      'es',
      expect.objectContaining({
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      })
    );
  });

  it('rejects a locale outside the catalogue', async () => {
    const response = await POST(localeRequest('fr'));

    expect(response.status).toBe(400);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
