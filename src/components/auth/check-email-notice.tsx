'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resendConfirmationAction } from '@/actions/auth.actions';
import { authMessage } from '@/lib/auth/messages';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';

const COPY = {
  es: {
    title: 'Revisa tu correo',
    body: 'Te enviamos un enlace de confirmación a',
    resend: 'Reenviar correo',
    resending: 'Enviando…',
    sent: 'Enviado — revisa tu bandeja de entrada.',
    loginLink: 'Volver a iniciar sesión',
  },
  en: {
    title: 'Check your email',
    body: 'We sent a confirmation link to',
    resend: 'Resend email',
    resending: 'Sending…',
    sent: 'Sent — check your inbox.',
    loginLink: 'Back to sign in',
  },
} as const;

/**
 * Aviso de «cuenta pendiente de confirmar» con reenvío del correo.
 *
 * Lo usa el registro cuando el alta queda sin sesión (confirmación por email
 * activa) y el login cuando Supabase responde `email_not_confirmed`. El enlace
 * a login solo se muestra fuera de la página de login (`loginLink`).
 */
export function CheckEmailNotice({
  email,
  locale,
  loginLink = false,
}: {
  email: string;
  locale: Locale;
  loginLink?: boolean;
}) {
  const copy = COPY[locale];
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleResend() {
    setError('');
    setSent(false);
    setSending(true);

    const result = await resendConfirmationAction({ email, locale });

    setSending(false);
    if (!result.ok) {
      setError(authMessage(result.code, locale));
      return;
    }
    setSent(true);
  }

  return (
    <div className="space-y-4" role="status">
      <div>
        <p className="text-text-primary text-sm font-semibold">{copy.title}</p>
        <p className="text-text-secondary mt-2 text-sm leading-6">
          {copy.body} <span className="text-text-primary font-semibold">{email}</span>.
        </p>
      </div>

      <button
        type="button"
        onClick={handleResend}
        disabled={sending}
        className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex w-full items-center justify-center rounded-full border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {sending ? copy.resending : copy.resend}
      </button>

      {sent ? <p className="text-accent-hover text-sm font-semibold">{copy.sent}</p> : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      {loginLink ? (
        <p className="text-text-secondary text-center text-sm">
          <Link
            href={localizeHref(locale, '/login')}
            className="text-accent-primary font-semibold hover:underline"
          >
            {copy.loginLink}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
