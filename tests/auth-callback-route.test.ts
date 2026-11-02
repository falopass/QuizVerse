/**
 * Contrato de GET /callback: el `next` nunca puede apuntar fuera del sitio y
 * todo error (del proveedor o del canje PKCE) vuelve a `/{locale}/login` con
 * `?error=oauth`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

import { GET } from '@/app/(auth)/callback/route';

const get = (query: string) => GET(new Request(`https://quizverse.org/callback${query}`));
const location = (response: Response) => response.headers.get('location');

beforeEach(() => {
  mocks.exchangeCodeForSession.mockReset().mockResolvedValue({ data: {}, error: null });
});

describe('GET /callback', () => {
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
