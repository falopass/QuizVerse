/**
 * Contrato de `GET /[locale]/daily`: 307 al quiz de hoy del idioma, al
 * explorador si no hay catálogo, sin caché ni indexación, y 404 para locales
 * inexistentes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/data/daily-quiz', () => ({
  getDailyQuizSlug: vi.fn(),
}));

import { GET } from '@/app/[locale]/daily/route';
import { getDailyQuizSlug } from '@/lib/data/daily-quiz';

const mockGetSlug = vi.mocked(getDailyQuizSlug);

function callDaily(locale: string) {
  return GET(new Request(`http://localhost/${locale}/daily`), {
    params: Promise.resolve({ locale }),
  });
}

describe('GET /[locale]/daily', () => {
  beforeEach(() => {
    mockGetSlug.mockReset();
  });

  it('redirige 307 al quiz de hoy sin cachear ni indexar', async () => {
    mockGetSlug.mockResolvedValue('es-quiz-de-hoy');

    const res = await callDaily('es');

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/es/quiz/es-quiz-de-hoy');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(mockGetSlug).toHaveBeenCalledWith('es');
  });

  it('sin catálogo redirige 307 al explorador del idioma', async () => {
    mockGetSlug.mockResolvedValue(null);

    const res = await callDaily('en');

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/en/quiz');
  });

  it('con locale inválido responde 404', async () => {
    const res = await callDaily('xx');

    expect(res.status).toBe(404);
    expect(mockGetSlug).not.toHaveBeenCalled();
  });
});
