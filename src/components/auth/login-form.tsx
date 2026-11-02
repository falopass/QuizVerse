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
    email: 'Email',
    password: 'Contraseña',
    submit: 'Entrar',
    submitting: 'Entrando…',
    forgot: '¿Olvidaste tu contraseña?',
    noAccount: '¿No tienes cuenta?',
    signUp: 'Crea una',
  },
  en: {
    email: 'Email',
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
export function LoginForm({ locale, redirectTo }: { locale: Locale; redirectTo: string }) {
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

      <label className="block">
        <span className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase">
          {copy.password}
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-border-subtle bg-bg-primary text-text-primary focus:border-accent-primary w-full rounded-full border px-4 py-3 text-sm outline-none"
        />
      </label>

      <p className="text-right">
        <Link
          href={`${localizeHref(locale, '/forgot-password')}${email ? `?email=${encodeURIComponent(email)}` : ''}`}
          className="text-text-secondary hover:text-accent-primary text-xs font-semibold transition-colors"
        >
          {copy.forgot}
        </Link>
      </p>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      {errorCode === 'email_not_confirmed' ? (
        <CheckEmailNotice email={email} locale={locale} />
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent-primary hover:bg-accent-hover text-bg-primary w-full rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? copy.submitting : copy.submit}
      </button>

      <p className="text-text-secondary pt-1 text-center text-sm">
        {copy.noAccount}{' '}
        <Link
          href={`${localizeHref(locale, '/register')}?redirect=${encodeURIComponent(redirectTo)}`}
          className="text-accent-primary font-semibold hover:underline"
        >
          {copy.signUp}
        </Link>
      </p>
    </form>
  );
}
