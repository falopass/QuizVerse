/**
 * Contract tests for POST /api/auth/send-email — the Supabase/GoTrue Send
 * Email Hook. Covers Standard Webhooks signature, streaming body byte limit,
 * per-message durable claim with partial-failure recovery and concurrent
 * duplicate protection (hallazgo A-13), plus bilingual templates/planning.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendEmails: vi.fn(),
  getRedis: vi.fn(),
}));

vi.mock('@/lib/email/send', () => ({
  sendAuthEmail: mocks.sendEmail,
  sendAuthEmails: mocks.sendEmails,
  getEmailBinding: vi.fn(),
}));

vi.mock('@/lib/utils/redis', () => ({
  getRedis: mocks.getRedis,
}));

import { POST } from '@/app/api/auth/send-email/route';
import {
  buildVerifyUrl,
  planAuthEmails,
  resolveEmailLocale,
  safeRedirectTo,
} from '@/lib/email/plan';

const SECRET_B64 = btoa('0123456789abcdef0123456789abcdef');
const SECRET = `v1,whsec_${SECRET_B64}`;
const VERIFY_BASE = 'https://api.quizverse.org/auth/v1/verify';

const encoder = new TextEncoder();

function createMemoryRedis() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    del: async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    },
  };
}

async function sign(body: string, id: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(SECRET_B64), (char) => char.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${id}.${timestamp}.${body}`)
  );
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `v1,${btoa(binary)}`;
}

interface SignedInit {
  id?: string;
  timestamp?: number;
  signature?: string;
  tamper?: string;
}

async function hookRequest(body: string, init: SignedInit = {}): Promise<Request> {
  const id = init.id ?? 'msg_test_1';
  const timestamp = init.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = init.signature ?? (await sign(init.tamper ?? body, id, timestamp));
  return new Request('http://test/api/auth/send-email', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signature,
    },
  });
}

function payload(overrides: {
  type?: string;
  email?: string;
  newEmail?: string;
  redirectTo?: string;
  token?: string;
  tokenHash?: string;
  tokenNew?: string;
  tokenHashNew?: string;
  metadata?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}) {
  return JSON.stringify({
    user: {
      id: '8484b834-f29e-4af2-bf42-80644d154f76',
      email: overrides.email ?? 'user@example.com',
      ...(overrides.newEmail !== undefined ? { new_email: overrides.newEmail } : {}),
      user_metadata: overrides.metadata ?? {},
      ...(overrides.extra ?? {}),
    },
    email_data: {
      token: overrides.token ?? '123456',
      token_hash: overrides.tokenHash ?? 'hashAAA111bbb222ccc333',
      redirect_to: overrides.redirectTo ?? 'https://quizverse.org/en',
      email_action_type: overrides.type ?? 'recovery',
      site_url: 'https://quizverse.org',
      token_new: overrides.tokenNew ?? '',
      token_hash_new: overrides.tokenHashNew ?? '',
    },
  });
}

beforeEach(() => {
  mocks.sendEmail.mockReset().mockResolvedValue({ messageId: 'msg-cf-1' });
  mocks.sendEmails.mockReset().mockResolvedValue(undefined);
  mocks.getRedis.mockReset().mockReturnValue(null);
  process.env.SEND_EMAIL_HOOK_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://api.quizverse.org';
});

describe('POST /api/auth/send-email — firma y límite de cuerpo', () => {
  it('acepta una firma válida y envía el correo', async () => {
    const response = await POST(await hookRequest(payload({ type: 'recovery' })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    const [message] = mocks.sendEmail.mock.calls[0];
    expect(message.to).toBe('user@example.com');
    expect(message.subject).toBe('Reset your QuizVerse password');
    expect(message.html).toContain('token=hashAAA111bbb222ccc333');
    expect(message.html).toContain('type=recovery');
    expect(message.text).toBeTruthy();
  });

  it('corta el stream con 413 si el cuerpo supera 64 KiB sin content-length', async () => {
    let pulledChunks = 0;
    const chunk = new Uint8Array(24 * 1024).fill(97); // 24 KiB por chunk
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulledChunks += 1;
        if (pulledChunks <= 10) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const request = new Request('http://test/api/auth/send-email', {
      method: 'POST',
      body: stream,
      // @ts-expect-error duplex requerido en streams de Node/Undici
      duplex: 'half',
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { http_code: 413, message: 'payload_too_large' },
    });
    // Canceló el stream al cruzar 64 KiB sin leer los 10 chunks completos.
    expect(pulledChunks).toBeLessThan(10);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('rechaza sin headers de firma', async () => {
    const response = await POST(
      new Request('http://test/api/auth/send-email', {
        method: 'POST',
        body: payload({}),
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { http_code: 401, message: 'invalid_signature' },
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('rechaza una firma sobre otro cuerpo', async () => {
    const body = payload({});
    const request = await hookRequest(body, { tamper: payload({ type: 'invite' }) });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('deduplica por webhook-id y destinatario sin guardar el email en claro en Redis', async () => {
    const redis = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);
    const body = payload({ type: 'recovery' });

    const first = await POST(await hookRequest(body));
    const second = await POST(await hookRequest(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    for (const key of redis.store.keys()) {
      expect(key).not.toContain('user@example.com');
    }
  });

  it('conserva envíos previos en fallo parcial de 2 destinatarios y reenvía solo el pendiente (A-13)', async () => {
    const redis = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const body = payload({
      type: 'email_change',
      email: 'old@example.com',
      newEmail: 'new@example.com',
      token: '111111',
      tokenHash: 'hashForNewEmail',
      tokenNew: '222222',
      tokenHashNew: 'hashForCurrentEmail',
    });

    // Primer intento: 1.º correo (new@example.com) pasa, 2.º (old@example.com) falla.
    mocks.sendEmail
      .mockResolvedValueOnce({ messageId: 'm-new' })
      .mockRejectedValueOnce(Object.assign(new Error('temp fail'), { code: 'E_TEMP' }));

    const first = await POST(await hookRequest(body, { id: 'msg_partial_1' }));
    expect(first.status).toBe(503);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe('new@example.com');
    expect(mocks.sendEmail.mock.calls[1][0].to).toBe('old@example.com');

    // Reintento de GoTrue con un webhook-id NUEVO (contrato real de hookshttp.go):
    // conserva el 1.º correo ya marcado y solo envía old@example.com.
    mocks.sendEmail.mockResolvedValueOnce({ messageId: 'm-old' });
    const retry = await POST(await hookRequest(body, { id: 'msg_partial_2' }));
    expect(retry.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(3);
    expect(mocks.sendEmail.mock.calls[2][0].to).toBe('old@example.com');

    // Tercer replay: ambos ya están en `sent`, cero envíos extra.
    const replay = await POST(await hookRequest(body, { id: 'msg_partial_3' }));
    expect(replay.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(3);

    // Una solicitud nueva con tokens distintos sí se envía (no queda deduplicada).
    const freshBody = payload({
      type: 'email_change',
      email: 'old@example.com',
      newEmail: 'new@example.com',
      token: '999999',
      tokenHash: 'hashFreshNew',
      tokenNew: '888888',
      tokenHashNew: 'hashFreshOld',
    });
    mocks.sendEmail
      .mockResolvedValueOnce({ messageId: 'm-fresh-1' })
      .mockResolvedValueOnce({ messageId: 'm-fresh-2' });
    const fresh = await POST(await hookRequest(freshBody, { id: 'msg_fresh_1' }));
    expect(fresh.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(5);

    errorSpy.mockRestore();
  });

  it('bloquea con 503 una entrega concurrente mientras la primera sigue en vuelo (A-13)', async () => {
    const redis = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);
    const body = payload({ type: 'recovery' });

    let releaseFirst!: () => void;
    mocks.sendEmail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = () => resolve({ messageId: 'm-1' });
        })
    );

    const firstPromise = POST(await hookRequest(body, { id: 'msg_race_1' }));
    // Espera un tick para que el primer request adquiera el claim `sending`.
    await Promise.resolve();
    await Promise.resolve();

    const concurrent = await POST(await hookRequest(body, { id: 'msg_race_1' }));
    expect(concurrent.status).toBe(503);
    expect(concurrent.headers.get('retry-after')).toBe('5');
    expect(await concurrent.json()).toEqual({
      error: { http_code: 503, message: 'email_delivery_in_progress' },
    });

    releaseFirst();
    const first = await firstPromise;
    expect(first.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('rechaza una firma con timestamp caducado', async () => {
    const stale = Math.floor(Date.now() / 1000) - 10 * 60;
    const response = await POST(await hookRequest(payload({}), { timestamp: stale }));

    expect(response.status).toBe(401);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('rechaza un timestamp del futuro lejano', async () => {
    const future = Math.floor(Date.now() / 1000) + 10 * 60;
    const response = await POST(await hookRequest(payload({}), { timestamp: future }));

    expect(response.status).toBe(401);
  });

  it('rechaza una firma con otro secreto', async () => {
    const body = payload({});
    const id = 'msg_x';
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('otra-clave'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign(
      'HMAC',
      wrongKey,
      encoder.encode(`${id}.${timestamp}.${body}`)
    );
    const signature = `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;

    const response = await POST(await hookRequest(body, { id, timestamp, signature }));

    expect(response.status).toBe(401);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('acepta cuando una de varias firmas de la cabecera coincide', async () => {
    const body = payload({});
    const id = 'msg_multi';
    const timestamp = Math.floor(Date.now() / 1000);
    const good = await sign(body, id, timestamp);
    const request = await hookRequest(body, {
      id,
      timestamp,
      signature: `v1,AAAA${'A'.repeat(40)}, ${good}`,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('devuelve 503 si falta el secreto', async () => {
    delete process.env.SEND_EMAIL_HOOK_SECRET;

    const response = await POST(await hookRequest(payload({})));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { http_code: 503, message: 'email_hook_not_configured' },
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/send-email — payload', () => {
  it('rechaza JSON inválido', async () => {
    const response = await POST(await hookRequest('esto no es json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { http_code: 400, message: 'invalid_json' },
    });
  });

  it('rechaza payload sin email_data', async () => {
    const response = await POST(await hookRequest(JSON.stringify({ user: { email: 'a@b.c' } })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { http_code: 400, message: 'invalid_payload' },
    });
  });

  it('rechaza un email_action_type desconocido', async () => {
    const response = await POST(await hookRequest(payload({ type: 'nuclear_launch' })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { http_code: 400, message: 'invalid_payload' },
    });
  });

  it('rechaza cuando no hay destinatario válido', async () => {
    const response = await POST(await hookRequest(payload({ email: 'no-es-un-email' })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { http_code: 400, message: 'missing_recipient' },
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/send-email — envío', () => {
  it('devuelve 503 con formato del hook cuando el binding falla', async () => {
    const bindingError = Object.assign(new Error('smtp down'), { code: 'E_INTERNAL_SERVER_ERROR' });
    mocks.sendEmail.mockRejectedValue(bindingError);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(await hookRequest(payload({ type: 'recovery' })));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(await response.json()).toEqual({
      error: { http_code: 503, message: 'email_send_failed' },
    });
    // El log lleva el tipo y el código del binding, nunca correos ni tokens.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0][0] as string;
    expect(logged).toContain('recovery');
    expect(logged).toContain('E_INTERNAL_SERVER_ERROR');
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('hashAAA');
    errorSpy.mockRestore();
  });

  it('manda los dos correos de email_change con Secure Email Change', async () => {
    const response = await POST(
      await hookRequest(
        payload({
          type: 'email_change',
          email: 'old@example.com',
          newEmail: 'new@example.com',
          token: '111111',
          tokenHash: 'hashForNewEmail',
          tokenNew: '222222',
          tokenHashNew: 'hashForCurrentEmail',
        })
      )
    );

    expect(response.status).toBe(200);
    const messages = mocks.sendEmail.mock.calls.map(
      (call) => call[0] as { to: string; subject: string; html: string; text: string }
    );
    expect(messages).toHaveLength(2);
    const toNew = messages.find((m) => m.to === 'new@example.com');
    const toCurrent = messages.find((m) => m.to === 'old@example.com');
    // Al correo nuevo va token_hash; al actual, token_hash_new (campos invertidos).
    expect(toNew?.html).toContain('token=hashForNewEmail');
    expect(toNew?.html).toContain('type=email_change');
    expect(toCurrent?.html).toContain('token=hashForCurrentEmail');
    expect(toCurrent?.html).toContain('type=email_change');
  });

  it('manda un solo correo de email_change sin Secure Email Change', async () => {
    const response = await POST(
      await hookRequest(
        payload({
          type: 'email_change',
          email: 'old@example.com',
          newEmail: 'new@example.com',
          token: '333333',
          tokenHash: 'hashForNewEmail',
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    const [message] = mocks.sendEmail.mock.calls[0];
    expect(message.to).toBe('new@example.com');
    expect(message.html).toContain('token=hashForNewEmail');
  });
});

describe('planAuthEmails — tipos e idiomas', () => {
  const user = { email: 'user@example.com' };
  const baseData = {
    token: '123456',
    token_hash: 'theTokenHash123',
    redirect_to: 'https://quizverse.org/en',
    site_url: 'https://quizverse.org',
    token_new: '',
    token_hash_new: '',
  };

  it.each([
    ['signup', 'Confirm your QuizVerse account', 'Confirma tu cuenta de QuizVerse'],
    ['recovery', 'Reset your QuizVerse password', 'Restablece tu contraseña de QuizVerse'],
    ['invite', 'You’ve been invited to QuizVerse', 'Te invitaron a QuizVerse'],
    ['magiclink', 'Your QuizVerse sign-in link', 'Tu enlace de acceso a QuizVerse'],
  ])('%s: asunto en ambos idiomas y enlace verify correcto', (type, enSubject, esSubject) => {
    for (const [redirectTo, subject, lang] of [
      ['https://quizverse.org/en', enSubject, 'en'],
      ['https://quizverse.org/es', esSubject, 'es'],
    ] as const) {
      const plans = planAuthEmails(
        user,
        { ...baseData, email_action_type: type, redirect_to: redirectTo },
        VERIFY_BASE
      );
      expect('error' in plans).toBe(false);
      if ('error' in plans) return;
      expect(plans).toHaveLength(1);
      expect(plans[0].subject).toBe(subject);
      expect(plans[0].html).toContain(`<html lang="${lang}">`);
      // En el HTML la URL sale escapada (& → &amp;): se comprueba por partes.
      expect(plans[0].html).toContain('/auth/v1/verify?token=theTokenHash123');
      expect(plans[0].html).toContain(`type=${type}`);
      expect(plans[0].html).toContain('redirect_to=');
      expect(plans[0].text).toContain(
        `https://api.quizverse.org/auth/v1/verify?token=theTokenHash123&type=${type}&redirect_to=`
      );
    }
  });

  it('reauthentication manda el código OTP sin enlace', () => {
    const plans = planAuthEmails(
      user,
      { ...baseData, email_action_type: 'reauthentication' },
      VERIFY_BASE
    );

    expect('error' in plans).toBe(false);
    if ('error' in plans) return;
    expect(plans[0].subject).toBe('123456 is your QuizVerse verification code');
    expect(plans[0].html).toContain('123456');
    expect(plans[0].html).not.toContain('/auth/v1/verify');
  });

  it('email (OTP de acceso) manda el código sin enlace', () => {
    const plans = planAuthEmails(user, { ...baseData, email_action_type: 'email' }, VERIFY_BASE);

    expect('error' in plans).toBe(false);
    if ('error' in plans) return;
    expect(plans[0].html).toContain('123456');
    expect(plans[0].subject).toBe('Your QuizVerse sign-in code');
  });

  it('descarta redirect_to externo del enlace de verificación', () => {
    const plans = planAuthEmails(
      user,
      {
        ...baseData,
        email_action_type: 'recovery',
        redirect_to: 'https://evil.example.com/phish',
      },
      VERIFY_BASE
    );

    expect('error' in plans).toBe(false);
    if ('error' in plans) return;
    expect(plans[0].html).toContain('/auth/v1/verify?token=theTokenHash123&amp;type=recovery');
    expect(plans[0].html).not.toContain('evil.example.com');
    expect(plans[0].html).not.toContain('redirect_to=');
  });

  it('acepta redirect_to de subdominios de quizverse.org', () => {
    const plans = planAuthEmails(
      user,
      {
        ...baseData,
        email_action_type: 'recovery',
        redirect_to: 'https://www.quizverse.org/es/reset-password',
      },
      VERIFY_BASE
    );

    expect('error' in plans).toBe(false);
    if ('error' in plans) return;
    expect(plans[0].html).toContain('redirect_to=https%3A%2F%2Fwww.quizverse.org');
  });

  it('las notificaciones no llevan enlace ni código', () => {
    for (const type of [
      'password_changed_notification',
      'phone_changed_notification',
      'identity_linked_notification',
      'identity_unlinked_notification',
      'mfa_factor_enrolled_notification',
      'mfa_factor_unenrolled_notification',
    ]) {
      const plans = planAuthEmails(
        user,
        { ...baseData, email_action_type: type, provider: 'google', factor_type: 'totp' },
        VERIFY_BASE
      );
      expect('error' in plans, type).toBe(false);
      if ('error' in plans) continue;
      expect(plans[0].html, type).not.toContain('/auth/v1/verify');
      expect(plans[0].subject, type).toBeTruthy();
    }
  });

  it('email_changed_notification va a la dirección anterior', () => {
    const plans = planAuthEmails(
      user,
      {
        ...baseData,
        email_action_type: 'email_changed_notification',
        old_email: 'old@example.com',
      },
      VERIFY_BASE
    );

    expect('error' in plans).toBe(false);
    if ('error' in plans) return;
    expect(plans[0].to).toBe('old@example.com');
  });

  it('rechaza tipos fuera de la lista de GoTrue', () => {
    const plans = planAuthEmails(
      user,
      { ...baseData, email_action_type: 'custom_thing' },
      VERIFY_BASE
    );
    expect(plans).toEqual({ error: 'unsupported_type' });
  });
});

describe('resolveEmailLocale', () => {
  it('detecta /es en el path del redirect_to', () => {
    expect(resolveEmailLocale('https://quizverse.org/es/reset', null)).toBe('es');
    expect(resolveEmailLocale('https://quizverse.org/en/reset', null)).toBe('en');
  });

  it('detecta el locale dentro de /callback?next=', () => {
    expect(resolveEmailLocale('https://quizverse.org/callback?next=%2Fes', null)).toBe('es');
    expect(
      resolveEmailLocale('https://quizverse.org/callback?next=%2Fes%2Freset-password', null)
    ).toBe('es');
    expect(resolveEmailLocale('https://quizverse.org/callback?next=%2Fen', null)).toBe('en');
  });

  it('lo indica user_metadata cuando el redirect_to no trae locale', () => {
    expect(resolveEmailLocale('https://quizverse.org/', { i18n: 'es' })).toBe('es');
    expect(resolveEmailLocale(undefined, { locale: 'es-CL' })).toBe('es');
    expect(resolveEmailLocale('https://quizverse.org/', { language: 'en' })).toBe('en');
  });

  it('el locale explícito del redirect_to gana a user_metadata', () => {
    // Recuperación pedida desde /en por una cuenta registrada en /es.
    expect(resolveEmailLocale('https://quizverse.org/en', { i18n: 'es' })).toBe('en');
    expect(resolveEmailLocale('https://quizverse.org/callback?next=%2Fen', { locale: 'es' })).toBe(
      'en'
    );
    expect(resolveEmailLocale('https://quizverse.org/es', { locale: 'en' })).toBe('es');
  });
});

describe('safeRedirectTo / buildVerifyUrl', () => {
  it('admite quizverse.org y subdominios', () => {
    expect(safeRedirectTo('https://quizverse.org/es')).toBe('https://quizverse.org/es');
    expect(safeRedirectTo('https://www.quizverse.org/x')).toBe('https://www.quizverse.org/x');
    expect(safeRedirectTo('http://quizverse.org/es')).toBeNull();
    expect(safeRedirectTo('https://quizverse.org.evil.com/')).toBeNull();
    expect(safeRedirectTo('https://evilquizverse.org/')).toBeNull();
    expect(safeRedirectTo('javascript:alert(1)')).toBeNull();
    expect(safeRedirectTo('not a url')).toBeNull();
  });

  it('construye el verify URL con token, type y redirect_to', () => {
    expect(buildVerifyUrl(VERIFY_BASE, 'hashX', 'signup', 'https://quizverse.org/es')).toBe(
      'https://api.quizverse.org/auth/v1/verify?token=hashX&type=signup&redirect_to=https%3A%2F%2Fquizverse.org%2Fes'
    );
    expect(buildVerifyUrl(VERIFY_BASE, 'hashX', 'signup', 'https://evil.com')).toBe(
      'https://api.quizverse.org/auth/v1/verify?token=hashX&type=signup'
    );
  });
});
