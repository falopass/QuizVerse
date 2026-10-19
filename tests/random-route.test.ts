/**
 * Contrato del route handler `GET /[locale]/random`: un 307 al quiz al azar
 * del idioma, al explorador si el catálogo está vacío (nunca 500) y 404 para
 * locales que no existen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/data/random-quiz', () => ({
  getRandomQuizSlug: vi.fn(),
}));

import { GET } from '@/app/[locale]/random/route';
import { getRandomQuizSlug } from '@/lib/data/random-quiz';

const mockGetSlug = vi.mocked(getRandomQuizSlug);

function callRandom(locale: string) {
  return GET(new Request(`http://localhost/${locale}/random`), {
    params: Promise.resolve({ locale }),
  });
}

describe('GET /[locale]/random', () => {
  beforeEach(() => {
    mockGetSlug.mockReset();
  });

  it('redirige 307 al quiz publicado del idioma', async () => {
    mockGetSlug.mockResolvedValue('es-quiz-aleatorio');

    const res = await callRandom('es');

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe('/es/quiz/es-quiz-aleatorio');
    expect(mockGetSlug).toHaveBeenCalledWith('es');
  });

  it('con catálogo vacío redirige 307 al explorador del idioma', async () => {
    mockGetSlug.mockResolvedValue(null);

    const res = await callRandom('es');

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/es/quiz');
  });

  it('con locale inválido responde 404', async () => {
    const res = await callRandom('xx');

    expect(res.status).toBe(404);
    expect(mockGetSlug).not.toHaveBeenCalled();
  });
});
