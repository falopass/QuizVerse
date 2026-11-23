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
        <label
          htmlFor="register-name"
          className="text-text-secondary mb-1.5 block text-xs font-semibold"
        >
          {labels.name}
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary w-full rounded-[4px] border px-4 py-3 text-sm transition-colors"
          placeholder={labels.name}
          autoComplete="name"
        />
      </div>

      <div>
        <label
          htmlFor="register-email"
          className="text-text-secondary mb-1.5 block text-xs font-semibold"
        >
          {labels.email}
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary w-full rounded-[4px] border px-4 py-3 text-sm transition-colors"
          placeholder={locale === 'es' ? 'tu@correo.com' : 'you@example.com'}
          autoComplete="email"
        />
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="text-text-secondary mb-1.5 block text-xs font-semibold"
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
          className="border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary w-full rounded-[4px] border px-4 py-3 text-sm transition-colors"
          placeholder="········"
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p
          className="border-error/40 bg-error/10 text-error rounded-[4px] border px-4 py-3 text-sm font-semibold"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent-primary hover:bg-accent-hover text-bg-primary inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? '...' : labels.submit}
      </button>
    </form>
  );
}
