import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATTEMPT_TTL_SECONDS,
  createQuizAttempt,
  sessionIdsForAttempt,
  verifyQuizAttempt,
} from '@/lib/quiz/attempt';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_QUIZ_ID = '223e4567-e89b-42d3-a456-426614174001';
const NOW = 1_700_000_000_000;

/** Firma un payload arbitrario con el mismo secreto: prueba la validación de forma. */
async function signPayload(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('unit-test-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = `v1.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  return `${signed}.${Buffer.from(new Uint8Array(signature)).toString('base64url')}`;
}

beforeEach(() => {
  process.env.QUIZ_ATTEMPT_SECRET = 'unit-test-secret';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  delete process.env.QUIZ_ATTEMPT_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('createQuizAttempt / verifyQuizAttempt', () => {
  it('emite un token válido para el quiz y lo verifica', async () => {
    const created = await createQuizAttempt(QUIZ_ID, NOW);
    expect(created).not.toBeNull();

    const verified = await verifyQuizAttempt(created!.token, QUIZ_ID, NOW + 1000);

    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.attempt.quizId).toBe(QUIZ_ID);
    expect(verified.attempt.attemptId).toBe(created!.attempt.attemptId);
    expect(verified.attempt.attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(verified.attempt.expiresAt).toBe(verified.attempt.issuedAt + ATTEMPT_TTL_SECONDS);
  });

  it('rechaza el token de otro quiz', async () => {
    const created = await createQuizAttempt(QUIZ_ID, NOW);

    const verified = await verifyQuizAttempt(created!.token, OTHER_QUIZ_ID, NOW);

    expect(verified).toEqual({ ok: false, reason: 'quiz_mismatch' });
  });

  it('rechaza un token caducado', async () => {
    const created = await createQuizAttempt(QUIZ_ID, NOW);

    const verified = await verifyQuizAttempt(
      created!.token,
      QUIZ_ID,
      NOW + ATTEMPT_TTL_SECONDS * 1000 + 1
    );

    expect(verified).toEqual({ ok: false, reason: 'expired' });
  });

  it('rechaza un payload manipulado aunque conserve la firma', async () => {
    const created = await createQuizAttempt(QUIZ_ID, NOW);
    const [, , signature] = created!.token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ q: OTHER_QUIZ_ID, a: crypto.randomUUID(), iat: 1, exp: 9_999_999_999 })
    ).toString('base64url');

    const verified = await verifyQuizAttempt(
      `v1.${forgedPayload}.${signature}`,
      OTHER_QUIZ_ID,
      NOW
    );

    expect(verified).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rechaza un token malformado', async () => {
    expect(await verifyQuizAttempt('no-es-un-token', QUIZ_ID, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(await verifyQuizAttempt('v2.abc.def', QUIZ_ID, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(await verifyQuizAttempt('v1.@@@.###', QUIZ_ID, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('rechaza un payload firmado que no es JSON', async () => {
    const payload = Buffer.from('esto no es json').toString('base64url');

    expect(await verifyQuizAttempt(await signPayload(payload), QUIZ_ID, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('rechaza un payload firmado con campos de otro tipo', async () => {
    const payload = Buffer.from(
      JSON.stringify({ q: QUIZ_ID, a: 'x', iat: 'ayer', exp: 9_999_999_999 })
    ).toString('base64url');

    expect(await verifyQuizAttempt(await signPayload(payload), QUIZ_ID, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('distingue un token ausente', async () => {
    expect(await verifyQuizAttempt(null, QUIZ_ID, NOW)).toEqual({ ok: false, reason: 'missing' });
  });

  it('falla cerrado sin QUIZ_ATTEMPT_SECRET ni SUPABASE_SERVICE_ROLE_KEY', async () => {
    delete process.env.QUIZ_ATTEMPT_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(await createQuizAttempt(QUIZ_ID, NOW)).toBeNull();
    expect(await verifyQuizAttempt('v1.abc.def', QUIZ_ID, NOW)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('deriva el secreto de SUPABASE_SERVICE_ROLE_KEY cuando falta el explícito', async () => {
    delete process.env.QUIZ_ATTEMPT_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const created = await createQuizAttempt(QUIZ_ID, NOW);
    const verified = await verifyQuizAttempt(created!.token, QUIZ_ID, NOW);

    expect(verified.ok).toBe(true);
  });
});

describe('sessionIdsForAttempt', () => {
  it('deriva un id UUID y un share token estables para el mismo attempt', async () => {
    const first = await sessionIdsForAttempt('attempt-1');
    const second = await sessionIdsForAttempt('attempt-1');

    expect(first).toEqual(second);
    expect(first!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(first!.shareToken).toMatch(/^[0-9a-f]{16}$/);
  });

  it('cambia con el attempt', async () => {
    const first = await sessionIdsForAttempt('attempt-1');
    const second = await sessionIdsForAttempt('attempt-2');

    expect(first!.id).not.toBe(second!.id);
    expect(first!.shareToken).not.toBe(second!.shareToken);
  });
});
