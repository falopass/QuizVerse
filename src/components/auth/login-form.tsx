'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAction } from '@/actions/auth.actions';
import { authMessage } from '@/lib/auth/messages';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: { email: 'Email', password: 'Contraseña', submit: 'Entrar', submitting: 'Entrando…' },
  en: { email: 'Email', password: 'Password', submit: 'Sign in', submitting: 'Signing in…' },
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
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signInAction({ email, password });

    if (!result.ok) {
      setError(authMessage(result.code, locale));
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
    </form>
  );
}
