import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({
  eval: vi.fn(),
  hgetall: vi.fn(),
}));

vi.mock('@/lib/utils/redis', () => ({ getRedis: () => redis }));

import {
  claimHint,
  claimQuestionReveal,
  finalizeAttemptState,
  getAttemptReveals,
  initAttemptState,
} from '@/lib/quiz/attempt-store';

beforeEach(() => {
  redis.eval.mockReset();
  redis.hgetall.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('claimQuestionReveal con Redis', () => {
  it('usa el script atómico y acepta la pregunta cuando devuelve 1', async () => {
    redis.eval.mockResolvedValue(1);

    const claim = await claimQuestionReveal('attempt-1', 'q1', 0, 'a');

    expect(claim).toEqual({ ok: true });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('HGET'),
      ['quiz-attempt:attempt-1'],
      ['q1', '0', 'a', '10800']
    );
  });

  it('traduce 0 a pregunta ya revelada', async () => {
    redis.eval.mockResolvedValue(0);

    expect(await claimQuestionReveal('attempt-1', 'q1', 0, 'a')).toEqual({
      ok: false,
      reason: 'already_revealed',
    });
  });

  it('traduce -1 a pregunta fuera de orden', async () => {
    redis.eval.mockResolvedValue(-1);

    expect(await claimQuestionReveal('attempt-1', 'q1', 0, 'a')).toEqual({
      ok: false,
      reason: 'out_of_order',
    });
  });

  it('si Redis falla, falla cerrado con store_unavailable en vez de degradar a memoria por isolate', async () => {
    redis.eval.mockRejectedValue(new Error('redis down'));

    expect(await claimQuestionReveal('attempt-fallback', 'q1', 0, 'a')).toEqual({
      ok: false,
      reason: 'store_unavailable',
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('claimHint con Redis', () => {
  it('acepta 1 (primera pista) y 2 (misma pregunta repetida)', async () => {
    redis.eval.mockResolvedValue(1);
    expect(await claimHint('attempt-1', 'q1')).toEqual({ ok: true });

    redis.eval.mockResolvedValue(2);
    expect(await claimHint('attempt-1', 'q1')).toEqual({ ok: true });
  });

  it('traduce 0 a pista ya usada en otra pregunta', async () => {
    redis.eval.mockResolvedValue(0);

    expect(await claimHint('attempt-1', 'q2')).toEqual({
      ok: false,
      reason: 'hint_already_used',
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('hint'),
      ['quiz-attempt:attempt-1'],
      ['q2', '10800']
    );
  });

  it('si Redis falla, falla cerrado con store_unavailable', async () => {
    redis.eval.mockRejectedValue(new Error('redis down'));

    expect(await claimHint('attempt-hint-fallback', 'q1')).toEqual({
      ok: false,
      reason: 'store_unavailable',
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('getAttemptReveals y finalizeAttemptState con Redis', () => {
  it('filtra el campo "last" y devuelve solo las preguntas', async () => {
    redis.hgetall.mockResolvedValue({ 'q:q1': 'a', 'q:q2': 'b', last: '1' });

    expect(await getAttemptReveals('attempt-1')).toEqual({ q1: 'a', q2: 'b' });
  });

  it('devuelve null cuando el hash no existe', async () => {
    redis.hgetall.mockResolvedValue(null);

    expect(await getAttemptReveals('attempt-1')).toBeNull();
  });

  it('si Redis falla, devuelve null sin usar memoria local', async () => {
    redis.hgetall.mockRejectedValue(new Error('redis down'));

    expect(await getAttemptReveals('attempt-sin-memoria')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('initAttemptState y finalizeAttemptState consolidan una sola transición en Redis', async () => {
    redis.eval.mockResolvedValueOnce(1);
    expect(await initAttemptState('attempt-init')).toBe(true);

    redis.eval.mockResolvedValueOnce([
      1,
      ['init', '1', 'q:q1', 'a', 'q:q2', 'b', 'finalized', '1'],
    ]);
    const finalized = await finalizeAttemptState('attempt-init', { q1: 'x', q2: 'b' });
    expect(finalized).toEqual({
      ok: true,
      firstTime: true,
      choices: { q1: 'a', q2: 'b' },
      durable: true,
    });
  });
});
