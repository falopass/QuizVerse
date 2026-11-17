/**
 * `celebrate` difiere `canvas-confetti` hasta el momento de lanzar: con
 * `prefers-reduced-motion: reduce` o sin `window` no se importa nada, y la
 * cancelación para la lluvia aunque el import siga en vuelo.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn(() => Promise.resolve()) }));

import confetti from 'canvas-confetti';
import { celebrate } from '@/lib/ui/celebrate';

const confettiMock = vi.mocked(confetti);

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  confettiMock.mockClear();
});

describe('celebrate', () => {
  it('con prefers-reduced-motion devuelve noop y nunca lanza', async () => {
    vi.useFakeTimers();
    stubMatchMedia(true);

    const cancel = celebrate();
    await vi.advanceTimersByTimeAsync(5000);
    cancel();

    expect(confettiMock).not.toHaveBeenCalled();
  });

  it('no hace nada sin window (SSR)', () => {
    stubMatchMedia(false);
    vi.stubGlobal('window', undefined);

    const cancel = celebrate();
    cancel();

    expect(confettiMock).not.toHaveBeenCalled();
  });

  it('lanza ráfagas decrecientes hasta agotar la duración', async () => {
    vi.useFakeTimers();
    stubMatchMedia(false);

    celebrate({ durationMs: 1000, intervalMs: 250, particlesPerTick: 40 });
    await vi.advanceTimersByTimeAsync(250);

    expect(confettiMock).toHaveBeenCalledTimes(1);
    const first = confettiMock.mock.calls[0][0] as { particleCount: number };
    expect(first.particleCount).toBe(30); // 40 * (750/1000)

    await vi.advanceTimersByTimeAsync(250);
    expect(confettiMock).toHaveBeenCalledTimes(2);

    // Agotada la duración el intervalo se limpia solo: ticks en 250/500/750,
    // en 1000 el tiempo restante ya es 0 y no lanza.
    await vi.advanceTimersByTimeAsync(2000);
    expect(confettiMock).toHaveBeenCalledTimes(3);
  });

  it('la cancelación para la lluvia una vez empezada', async () => {
    vi.useFakeTimers();
    stubMatchMedia(false);

    const cancel = celebrate({ durationMs: 3000, intervalMs: 250 });
    await vi.advanceTimersByTimeAsync(500);
    expect(confettiMock.mock.calls.length).toBeGreaterThan(0);

    cancel();
    const callsAtCancel = confettiMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(confettiMock).toHaveBeenCalledTimes(callsAtCancel);
  });

  it('cancelar antes de que el import resuelva evita cualquier ráfaga', async () => {
    vi.useFakeTimers();
    stubMatchMedia(false);

    const cancel = celebrate();
    cancel();
    await vi.advanceTimersByTimeAsync(5000);

    expect(confettiMock).not.toHaveBeenCalled();
  });
});
