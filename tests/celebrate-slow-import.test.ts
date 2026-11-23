/**
 * Hermano de `celebrate.test.ts` para la descarga lenta: el `import` dinámico
 * tarda 800 ms y el plazo de la lluvia debe contar desde que el módulo carga,
 * no desde la llamada — si no, una descarga larga se comería la celebración
 * (la de personality ya es corta de por sí). Vive en su propio archivo porque
 * el factory del mock solo corre en el primer `import` del módulo: sin un
 * import estático aquí, lo dispara `celebrate` con el retardo.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', async () => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { default: vi.fn(() => Promise.resolve()) };
});

import { celebrate } from '@/lib/ui/celebrate';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('celebrate con descarga lenta', () => {
  it('el plazo corre desde que el módulo carga: la lluvia sale completa', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    celebrate({ durationMs: 1000, intervalMs: 250 });
    await vi.advanceTimersByTimeAsync(5000);

    const confettiMock = vi.mocked((await import('canvas-confetti')).default);
    expect(confettiMock.mock.calls.length).toBeGreaterThan(0);
  });
});
