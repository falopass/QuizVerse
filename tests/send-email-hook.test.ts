/**
 * Contract tests for POST /api/auth/send-email — the Supabase/GoTrue Send
 * Email Hook. GoTrue signs every call with Standard Webhooks; the endpoint
 * must reject unsigned or stale requests, validate the payload, render the
 * right bilingual template and send through the EMAIL binding. Failures answer
 * in the hook error format `{ error: { http_code, message } }`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getRedis: vi.fn(),
}));

vi.mock('@/lib/email/send', () => ({
  sendAuthEmails: mocks.send,
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
  mocks.send.mockReset().mockResolvedValue(undefined);
  mocks.getRedis.mockReset().mockReturnValue(null);
  process.env.SEND_EMAIL_HOOK_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://api.quizverse.org';
});

describe('POST /api/auth/send-email — firma', () => {
  it('acepta una firma válida y envía el correo', async () => {
    const response = await POST(await hookRequest(payload({ type: 'recovery' })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const [messages] = mocks.send.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe('user@example.com');
    expect(messages[0].subject).toBe('Reset your QuizVerse password');
    expect(messages[0].html).toContain('token=hashAAA111bbb222ccc333');
    expect(messages[0].html).toContain('type=recovery');
    expect(messages[0].text).toBeTruthy();
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
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rechaza una firma sobre otro cuerpo', async () => {
    const body = payload({});
    const request = await hookRequest(body, { tamper: payload({ type: 'invite' }) });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('deduplica por webhook-id: una entrega repetida responde 200 sin reenviar', async () => {
    const store = new Map<string, unknown>();
    mocks.getRedis.mockReturnValue({
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown) => {
        store.set(key, value);
        return 'OK';
      },
    });
    const body = payload({ type: 'recovery' });

    const first = await POST(await hookRequest(body));
    const second = await POST(await hookRequest(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('rechaza una firma con timestamp caducado', async () => {
    const stale = Math.floor(Date.now() / 1000) - 10 * 60;
    const response = await POST(await hookRequest(payload({}), { timestamp: stale }));

    expect(response.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
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
    expect(mocks.send).not.toHaveBeenCalled();
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
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('devuelve 503 si falta el secreto', async () => {
    delete process.env.SEND_EMAIL_HOOK_SECRET;

    const response = await POST(await hookRequest(payload({})));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { http_code: 503, message: 'email_hook_not_configured' },
    });
    expect(mocks.send).not.toHaveBeenCalled();
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
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/send-email — envío', () => {
  it('devuelve 503 con formato del hook cuando el binding falla', async () => {
    const bindingError = Object.assign(new Error('smtp down'), { code: 'E_INTERNAL_SERVER_ERROR' });
    mocks.send.mockRejectedValue(bindingError);
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
    const [messages] = mocks.send.mock.calls[0] as [
      { to: string; subject: string; html: string; text: string }[],
    ];
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
    const [messages] = mocks.send.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe('new@example.com');
    expect(messages[0].html).toContain('token=hashForNewEmail');
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

  it('lo indica user_metadata', () => {
    expect(resolveEmailLocale('https://quizverse.org/en', { i18n: 'es' })).toBe('es');
    expect(resolveEmailLocale('https://quizverse.org/en', { locale: 'es-CL' })).toBe('es');
    expect(resolveEmailLocale('https://quizverse.org/en', { language: 'en' })).toBe('en');
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
