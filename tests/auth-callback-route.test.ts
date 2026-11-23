/**
 * Contrato de GET /callback:
 * - OAuth: `next` nunca puede apuntar fuera del sitio y todo error vuelve a
 *   `/{locale}/login?error=oauth`.
 * - Recuperación: exige desafío de recuperación real (`amr: recovery` en PKCE o
 *   `verifyOtp` con `type: 'recovery'`), emite la cookie HttpOnly firmada y en
 *   cualquier fallo redirige a `/{locale}/reset-password?error=expired`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

import { GET } from '@/app/(auth)/callback/route';
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/password-recovery';

function makeFakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

const RECOVERY_SECRET_ENV = 'PASSWORD_RECOVERY_SECRET';
const savedSecret = process.env[RECOVERY_SECRET_ENV];

const get = (query: string) => GET(new Request(`https://quizverse.org/callback${query}`));
const location = (response: Response) => response.headers.get('location');
const setCookieHeader = (response: Response) => response.headers.get('set-cookie') ?? '';

beforeEach(() => {
  process.env[RECOVERY_SECRET_ENV] = 'test-recovery-secret-0123456789abcdef';
  mocks.exchangeCodeForSession.mockReset().mockResolvedValue({ data: {}, error: null });
  mocks.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
});

afterAll(() => {
  if (savedSecret === undefined) delete process.env[RECOVERY_SECRET_ENV];
  else process.env[RECOVERY_SECRET_ENV] = savedSecret;
});

describe('GET /callback — OAuth y confirmación', () => {
  it('canjea el código y respeta un next interno', async () => {
    const response = await get('?code=abc&next=/es/home');

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(location(response)).toBe('https://quizverse.org/es/home');
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', '/en\\evil.com'])(
    'sanea un next malicioso (%s) y cae a /en',
    async (next) => {
      const response = await get(`?code=abc&next=${encodeURIComponent(next)}`);

      expect(location(response)).toBe('https://quizverse.org/en');
    }
  );

  it('cae a /es cuando el next malicioso conserva el prefijo de idioma', async () => {
    const response = await get(`?code=abc&next=${encodeURIComponent('/es//evil.com')}`);

    expect(location(response)).toBe('https://quizverse.org/es');
  });

  it('sin next aterriza en /en tras el canje', async () => {
    const response = await get('?code=abc');

    expect(location(response)).toBe('https://quizverse.org/en');
  });

  it('un error del proveedor vuelve al login del idioma conservando el destino', async () => {
    const response = await get('?error=access_denied&next=/es/create');

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response)).toBe(
      'https://quizverse.org/es/login?error=oauth&redirect=%2Fes%2Fcreate'
    );
  });

  it('un canje fallido vuelve al login del idioma conservando el destino', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: 'invalid grant' },
    });

    const response = await get('?code=abc&next=/es/home');

    expect(location(response)).toBe(
      'https://quizverse.org/es/login?error=oauth&redirect=%2Fes%2Fhome'
    );
  });

  it('un error sin next vuelve al login inglés con la home como destino', async () => {
    const response = await get('?error=access_denied');

    expect(location(response)).toBe('https://quizverse.org/en/login?error=oauth&redirect=%2Fen');
  });
});

describe('GET /callback — recuperación de contraseña (A-06)', () => {
  it('emite cookie HttpOnly firmada cuando PKCE confirma amr=recovery', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: 'u1' },
        session: {
          access_token: makeFakeJwt({
            session_id: 'sess-rec',
            amr: [{ method: 'recovery', timestamp: 1700000000 }],
          }),
        },
      },
      error: null,
    });

    const response = await get('?code=rec_code&next=%2Fes%2Freset-password');

    expect(location(response)).toBe('https://quizverse.org/es/reset-password');
    const cookie = setCookieHeader(response);
    expect(cookie).toContain(`${RECOVERY_COOKIE_NAME}=v1.`);
    expect(cookie).toContain('HttpOnly');
  });

  it('acepta token_hash + type=recovery vía verifyOtp', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        user: { id: 'u2' },
        session: { access_token: makeFakeJwt({ session_id: 'sess-otp' }) },
      },
      error: null,
    });

    const response = await get('?token_hash=hash123&type=recovery&next=%2Fen%2Freset-password');

    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash123', type: 'recovery' });
    expect(location(response)).toBe('https://quizverse.org/en/reset-password');
    expect(setCookieHeader(response)).toContain(`${RECOVERY_COOKIE_NAME}=v1.`);
  });

  it('rechaza un code de OAuth que intenta aterrizar en /reset-password', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: 'u1' },
        session: {
          access_token: makeFakeJwt({
            session_id: 'sess-oauth',
            amr: [{ method: 'oauth', provider: 'google' }],
          }),
        },
      },
      error: null,
    });

    const response = await get('?code=oauth_code&next=%2Fes%2Freset-password');

    expect(location(response)).toBe('https://quizverse.org/es/reset-password?error=expired');
    expect(setCookieHeader(response)).toContain(`${RECOVERY_COOKIE_NAME}=;`);
  });

  it('sin code ni token_hash en /reset-password redirige a error=expired sin habilitar cookie', async () => {
    const response = await get('?next=%2Fes%2Freset-password');

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response)).toBe('https://quizverse.org/es/reset-password?error=expired');
    expect(setCookieHeader(response)).toContain('Max-Age=0');
  });

  it('un error del proveedor en recuperación va a /reset-password?error=expired en el idioma correcto', async () => {
    const response = await get('?error=access_denied&next=%2Fen%2Freset-password');

    expect(location(response)).toBe('https://quizverse.org/en/reset-password?error=expired');
  });
});
