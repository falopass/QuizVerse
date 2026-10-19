'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction } from '@/actions/auth.actions';
import { authMessage } from '@/lib/auth/messages';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';

const COPY = {
  es: {
    email: 'Email',
    submit: 'Enviar enlace',
    submitting: 'Enviando…',
    emailError: 'Ingresa un email válido.',
    sentTitle: 'Revisa tu correo',
    sentBody:
      'Si ese email tiene cuenta, te llegó un enlace para crear una contraseña nueva. Revisa también el spam.',
    resend: 'Reenviar enlace',
    back: 'Volver a iniciar sesión',
  },
  en: {
    email: 'Email',
    submit: 'Send link',
    submitting: 'Sending…',
    emailError: 'Enter a valid email.',
    sentTitle: 'Check your inbox',
    sentBody:
      'If that email has an account, a link to set a new password is on its way. Check spam too.',
    resend: 'Resend link',
    back: 'Back to sign in',
  },
} as const;

/**
 * Pide el correo de recuperación. El éxito se muestra siempre con el mismo
 * texto: la respuesta no confirma si el email existe, así no se enumeran cuentas.
 */
export function ForgotPasswordForm({
  locale,
  initialEmail = '',
}: {
  locale: Locale;
  initialEmail?: string;
}) {
  const copy = COPY[locale];
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    let result;
    try {
      result = await forgotPasswordAction({ email, locale });
    } catch {
      result = { ok: false as const, code: 'unexpected' as const };
    }
    setLoading(false);

    if (!result.ok) {
      setError(
        result.code === 'invalid_input' ? copy.emailError : authMessage(result.code, locale)
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-green-500/30 bg-green-500/10 px-5 py-5">
          <p className="text-sm font-semibold text-green-400">{copy.sentTitle}</p>
          <p className="text-text-secondary mt-2 text-sm leading-6">{copy.sentBody}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-text-secondary hover:text-accent-primary text-sm font-semibold transition-colors"
          >
            {copy.resend}
          </button>
          <Link
            href={localizeHref(locale, '/login')}
            className="text-accent-primary text-sm font-semibold hover:underline"
          >
            {copy.back}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <label className="block">
        <span className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase">
          {copy.email}
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-border-subtle bg-bg-primary text-text-primary focus:border-accent-primary w-full rounded-full border px-4 py-3 text-sm outline-none"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent-primary hover:bg-accent-hover w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
      >
        {loading ? copy.submitting : copy.submit}
      </button>

      <p className="pt-1 text-center">
        <Link
          href={localizeHref(locale, '/login')}
          className="text-text-secondary hover:text-accent-primary text-xs font-semibold transition-colors"
        >
          {copy.back}
        </Link>
      </p>
    </form>
  );
}
