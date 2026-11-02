import { beforeEach, describe, expect, it } from 'vitest';
import { claimHint, claimQuestionReveal, getAttemptReveals } from '@/lib/quiz/attempt-store';

beforeEach(() => {
  // Sin Upstash configurado el store cae al Map del proceso: aquí se prueba
  // justamente ese fallback.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('claimQuestionReveal (fallback en memoria)', () => {
  it('acepta una pregunta nueva y la guarda', async () => {
    const attemptId = crypto.randomUUID();

    expect(await claimQuestionReveal(attemptId, 'q1', 0, 'a')).toEqual({ ok: true });
    expect(await getAttemptReveals(attemptId)).toEqual({ q1: 'a' });
  });

  it('rechaza la misma pregunta dos veces en el mismo attempt', async () => {
    const attemptId = crypto.randomUUID();

    await claimQuestionReveal(attemptId, 'q1', 0, 'a');
    const second = await claimQuestionReveal(attemptId, 'q1', 0, 'b');

    expect(second).toEqual({ ok: false, reason: 'already_revealed' });
    expect(await getAttemptReveals(attemptId)).toEqual({ q1: 'a' });
  });

  it('no deja retroceder a una pregunta anterior', async () => {
    const attemptId = crypto.randomUUID();

    await claimQuestionReveal(attemptId, 'q3', 2, 'c');
    const back = await claimQuestionReveal(attemptId, 'q1', 0, 'a');

    expect(back).toEqual({ ok: false, reason: 'out_of_order' });
    expect(await getAttemptReveals(attemptId)).toEqual({ q3: 'c' });
  });

  it('separa el estado por attempt', async () => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();

    await claimQuestionReveal(first, 'q1', 0, 'a');

    expect(await claimQuestionReveal(second, 'q1', 0, 'a')).toEqual({ ok: true });
  });

  it('devuelve null cuando el attempt no tiene estado', async () => {
    expect(await getAttemptReveals(crypto.randomUUID())).toBeNull();
  });
});

describe('claimHint (fallback en memoria)', () => {
  it('acepta la primera pista y repetir la misma pregunta', async () => {
    const attemptId = crypto.randomUUID();

    expect(await claimHint(attemptId, 'q1')).toEqual({ ok: true });
    expect(await claimHint(attemptId, 'q1')).toEqual({ ok: true });
  });

  it('rechaza una pista en otra pregunta de la misma partida', async () => {
    const attemptId = crypto.randomUUID();

    await claimHint(attemptId, 'q1');

    expect(await claimHint(attemptId, 'q2')).toEqual({
      ok: false,
      reason: 'hint_already_used',
    });
  });

  it('separa la pista por attempt', async () => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();

    await claimHint(first, 'q1');

    expect(await claimHint(second, 'q2')).toEqual({ ok: true });
  });
});
