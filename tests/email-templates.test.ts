/**
 * Pruebas unitarias de las plantillas de correo bilingües (`templates.ts`) y
 * del adaptador de envío (`send.ts`) (hallazgo D-14).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

import { renderAuthEmail, type AuthEmailType, type EmailLocale } from '@/lib/email/templates';
import { getEmailBinding, sendAuthEmail, sendAuthEmails } from '@/lib/email/send';

const ALL_TYPES: AuthEmailType[] = [
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email',
  'email_change',
  'email_change_current',
  'reauthentication',
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
];

describe('renderAuthEmail', () => {
  it.each(['en', 'es'] as EmailLocale[])(
    'renderiza los 15 tipos con asunto, HTML válido y texto plano en %s',
    (locale) => {
      for (const type of ALL_TYPES) {
        const rendered = renderAuthEmail(locale, type, {
          link: 'https://api.quizverse.org/auth/v1/verify?token=abc&type=recovery',
          otp: '654321',
          newEmail: 'nuevo@example.com',
          provider: 'facebook',
          factorType: 'totp',
        });

        expect(rendered.subject, `${locale}:${type}`).toBeTruthy();
        expect(rendered.html, `${locale}:${type}`).toContain('<!doctype html>');
        expect(rendered.html, `${locale}:${type}`).toContain(`<html lang="${locale}">`);
        expect(rendered.text, `${locale}:${type}`).toContain('QuizVerse —');
        expect(rendered.text, `${locale}:${type}`).toContain('https://quizverse.org');
      }
    }
  );

  it('escapa HTML en newEmail, provider, factorType, otp y link', () => {
    const rendered = renderAuthEmail('es', 'email_change', {
      link: 'https://api.quizverse.org/auth/v1/verify?a=1&b="><script>alert(1)</script>',
      newEmail: '<img src=x onerror=alert(1)>@example.com',
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('<img src=x');
    expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt;@example.com');
    expect(rendered.html).toContain('&amp;b=&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    // Texto plano conserva el valor legible sin entidades HTML.
    expect(rendered.text).toContain('<img src=x onerror=alert(1)>@example.com');
  });

  it('usa fallbacks seguros cuando faltan variables opcionales', () => {
    const esEmailChange = renderAuthEmail('es', 'email_change', {});
    expect(esEmailChange.html).toContain('la nueva dirección');

    const enIdentity = renderAuthEmail('en', 'identity_linked_notification', {});
    expect(enIdentity.html).toContain('OAuth');

    const esMfa = renderAuthEmail('es', 'mfa_factor_enrolled_notification', {});
    expect(esMfa.html).toContain('totp');
  });
});

describe('sendAuthEmail / sendAuthEmails', () => {
  beforeEach(() => {
    mocks.getCloudflareContext.mockReset();
  });

  it('devuelve null cuando no existe contexto de Cloudflare', async () => {
    mocks.getCloudflareContext.mockImplementation(() => {
      throw new Error('no cf context');
    });

    expect(await getEmailBinding()).toBeNull();
    await expect(
      sendAuthEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' })
    ).rejects.toThrow('email binding EMAIL not available');
  });

  it('envía uno o varios correos por el binding EMAIL desde noreply@quizverse.org', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'm-1' });
    mocks.getCloudflareContext.mockReturnValue({ env: { EMAIL: { send } } });

    const single = await sendAuthEmail({
      to: 'one@example.com',
      subject: 'Subj 1',
      html: '<p>1</p>',
      text: '1',
    });
    expect(single).toEqual({ messageId: 'm-1' });
    expect(send).toHaveBeenCalledWith({
      to: 'one@example.com',
      from: { email: 'noreply@quizverse.org', name: 'QuizVerse' },
      subject: 'Subj 1',
      html: '<p>1</p>',
      text: '1',
    });

    send.mockClear();
    await sendAuthEmails([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>', text: 'A' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>', text: 'B' },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].to).toBe('a@example.com');
    expect(send.mock.calls[1][0].to).toBe('b@example.com');
  });
});
