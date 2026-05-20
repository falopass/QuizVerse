'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface RegisterFormProps {
  labels: {
    email: string;
    password: string;
    name: string;
    submit: string;
  };
  redirectTo: string;
}

export function RegisterForm({ labels, redirectTo }: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
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
        className="bg-accent-primary inline-flex w-full items-center justify-center rounded-full px-4 py-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {loading ? '...' : labels.submit}
      </button>
    </form>
  );
}
