'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUpAction } from '@/actions/auth.actions';
import { authMessage } from '@/lib/auth/messages';
import { CheckEmailNotice } from '@/components/auth/check-email-notice';
import type { Locale } from '@/lib/i18n/dictionaries';

interface RegisterFormProps {
  labels: {
    email: string;
    password: string;
    name: string;
    submit: string;
  };
  redirectTo: string;
  locale?: Locale;
}

export function RegisterForm({ labels, redirectTo, locale = 'en' }: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // La validación, el rate limit y el saneado del username viven en el
    // servidor; aquí solo se envía lo que el jugador escribió.
    const result = await signUpAction({ email, password, name, locale });

    if (!result.ok) {
      setError(authMessage(result.code, locale));
      setLoading(false);
      return;
    }

    // Alta sin sesión: el correo de confirmación manda antes que cualquier
    // redirect; sin este aviso el usuario llegaba a la home sin sesión.
    if (result.needsEmailConfirmation) {
      setPendingEmail(email);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  if (pendingEmail) {
    return <CheckEmailNotice email={pendingEmail} locale={locale} loginLink />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="register-name" className="text-text-primary mb-1 block text-sm font-medium">
          {labels.name}
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
          placeholder={labels.name}
          autoComplete="name"
        />
      </div>

      <div>
        <label
          htmlFor="register-email"
          className="text-text-primary mb-1 block text-sm font-medium"
        >
          {labels.email}
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="text-text-primary mb-1 block text-sm font-medium"
        >
          {labels.password}
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus:border-accent-primary w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
          placeholder="········"
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent-primary text-bg-primary inline-flex w-full items-center justify-center rounded-full px-4 py-4 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {loading ? '...' : labels.submit}
      </button>
    </form>
  );
}
