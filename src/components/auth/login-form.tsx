'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInAction } from '@/actions/auth.actions';
import { authMessage } from '@/lib/auth/messages';
import { CheckEmailNotice } from '@/components/auth/check-email-notice';
import type { AuthErrorCode } from '@/lib/auth/identity';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';

const COPY = {
  es: {
    email: 'Correo electrónico',
    emailPlaceholder: 'tu@correo.com',
    password: 'Contraseña',
    submit: 'Entrar',
    submitting: 'Entrando…',
    forgot: '¿Olvidaste tu contraseña?',
    noAccount: '¿No tienes cuenta?',
    signUp: 'Crea una',
  },
  en: {
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    forgot: 'Forgot your password?',
    noAccount: "Don't have an account?",
    signUp: 'Create one',
  },
} as const;

/**
 * Formulario de acceso con email y contraseña.
 *
 * No habla con Supabase desde el navegador: llama a `signInAction`, que valida,
 * limita intentos y devuelve un código de error estable.
 */
export function LoginForm({
  locale,
  redirectTo,
  showRegisterLink = true,
}: {
  locale: Locale;
  redirectTo: string;
  /** Cuando la página ya muestra un único enlace a registro, evita duplicarlo. */
  showRegisterLink?: boolean;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<AuthErrorCode | ''>('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setErrorCode('');
    setLoading(true);

    const result = await signInAction({ email, password });

    if (!result.ok) {
      setError(authMessage(result.code, locale));
      setErrorCode(result.code);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <label className="block">
        <span className="text-text-secondary mb-1.5 block text-xs font-semibold">{copy.email}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary w-full rounded-[4px] border px-4 py-3 text-sm transition-colors"
        />
      </label>

      <label className="block">
        <span className="text-text-secondary mb-1.5 block text-xs font-semibold">
          {copy.password}
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="········"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary w-full rounded-[4px] border px-4 py-3 text-sm transition-colors"
        />
      </label>

      <p className="text-right">
        <Link
          href={`${localizeHref(locale, '/forgot-password')}${email ? `?email=${encodeURIComponent(email)}` : ''}`}
          className="text-text-secondary hover:text-accent-primary inline-flex min-h-9 items-center text-xs font-semibold transition-colors"
        >
          {copy.forgot}
        </Link>
      </p>

      {error ? (
        <p
          role="alert"
          className="border-error/40 bg-error/10 text-error rounded-[4px] border px-4 py-3 text-sm font-semibold"
        >
          {error}
        </p>
      ) : null}

      {errorCode === 'email_not_confirmed' ? (
        <CheckEmailNotice email={email} locale={locale} />
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent-primary hover:bg-accent-hover text-bg-primary min-h-12 w-full rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? copy.submitting : copy.submit}
      </button>

      {showRegisterLink ? (
        <p className="text-text-secondary pt-1 text-center text-sm">
          {copy.noAccount}{' '}
          <Link
            href={`${localizeHref(locale, '/register')}?redirect=${encodeURIComponent(redirectTo)}`}
            className="text-accent-primary font-semibold hover:underline"
          >
            {copy.signUp}
          </Link>
        </p>
      ) : null}
    </form>
  );
}
