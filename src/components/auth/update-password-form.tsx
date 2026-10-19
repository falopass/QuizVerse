'use client';

import { useState } from 'react';
import Link from 'next/link';
import { changePasswordAction, resetPasswordAction } from '@/actions/auth.actions';
import { authMessage } from '@/lib/auth/messages';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';

const COPY = {
  es: {
    currentPassword: 'Contraseña actual',
    password: 'Nueva contraseña',
    confirm: 'Repite la contraseña',
    submit: 'Guardar contraseña',
    submitting: 'Guardando…',
    mismatch: 'Las contraseñas no coinciden.',
    passwordError: 'Mínimo 8 caracteres.',
    currentRequired: 'Ingresa tu contraseña actual.',
    currentWrong: 'La contraseña actual no es correcta.',
    linkExpired: 'El enlace ya no sirve. Pide uno nuevo.',
    sessionExpired: 'Tu sesión caducó; inicia sesión de nuevo.',
    saved: 'Contraseña actualizada.',
    savedRecoveryTitle: 'Contraseña actualizada',
    savedRecoveryBody: 'Ya quedó lista tu contraseña nueva. Tu sesión sigue activa.',
    continueHome: 'Ir a QuizVerse',
  },
  en: {
    currentPassword: 'Current password',
    password: 'New password',
    confirm: 'Repeat the password',
    submit: 'Save password',
    submitting: 'Saving…',
    mismatch: 'Passwords do not match.',
    passwordError: '8 characters minimum.',
    currentRequired: 'Enter your current password.',
    currentWrong: 'The current password is not correct.',
    linkExpired: 'That link no longer works. Request a new one.',
    sessionExpired: 'Your session expired; sign in again.',
    saved: 'Password updated.',
    savedRecoveryTitle: 'Password updated',
    savedRecoveryBody: 'Your new password is set. Your session is still active.',
    continueHome: 'Go to QuizVerse',
  },
} as const;

type Field = 'currentPassword' | 'password' | 'confirm';
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_CLASS =
  'border-border-subtle bg-bg-primary text-text-primary focus:border-accent-primary w-full rounded-full border px-4 py-3 text-sm outline-none';

/**
 * Define la contraseña nueva. Dos modos con el mismo contrato del servidor:
 *
 * - `recovery`: tras el enlace del correo (`resetPasswordAction`); la sesión de
 *   recuperación es la autorización, no se pide la clave anterior.
 * - `settings`: cambio con sesión normal (`changePasswordAction`); si la cuenta
 *   tiene identidad por email (`requireCurrent`) revalida la clave vigente.
 *
 * El servidor vuelve a validar todo; aquí solo se compara la confirmación y se
 * traducen los códigos estables, nunca el mensaje crudo.
 */
export function UpdatePasswordForm({
  locale,
  mode,
  requireCurrent = false,
}: {
  locale: Locale;
  mode: 'recovery' | 'settings';
  requireCurrent?: boolean;
}) {
  const copy = COPY[locale];
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setNotice(null);

    if (password !== confirm) {
      setFieldErrors({ confirm: copy.mismatch });
      return;
    }

    setLoading(true);
    const action = mode === 'recovery' ? resetPasswordAction : changePasswordAction;
    let result;
    try {
      result = await action({
        password,
        ...(mode === 'settings' && requireCurrent ? { currentPassword } : {}),
      });
    } catch {
      result = { ok: false as const, code: 'unexpected' as const };
    }
    setLoading(false);

    if (result.ok) {
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      if (mode === 'recovery') {
        setSaved(true);
      } else {
        setNotice({ tone: 'success', text: copy.saved });
      }
      return;
    }

    if (result.code === 'invalid_input') {
      const errors = result.fieldErrors ?? {};
      const next: FieldErrors = {};
      if (errors.currentPassword?.length) next.currentPassword = copy.currentRequired;
      if (errors.password?.length) next.password = copy.passwordError;
      setFieldErrors(next);
      if (!Object.keys(next).length)
        setNotice({ tone: 'error', text: authMessage('unexpected', locale) });
      return;
    }

    if (result.code === 'invalid_credentials') {
      setFieldErrors({ currentPassword: copy.currentWrong });
      return;
    }

    if (result.code === 'weak_password') {
      setFieldErrors({ password: authMessage('weak_password', locale) });
      return;
    }

    if (result.code === 'unauthorized') {
      setNotice({
        tone: 'error',
        text: mode === 'recovery' ? copy.linkExpired : copy.sessionExpired,
      });
      return;
    }

    setNotice({ tone: 'error', text: authMessage(result.code, locale) });
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-green-500/30 bg-green-500/10 px-5 py-5">
          <p className="text-sm font-semibold text-green-400">{copy.savedRecoveryTitle}</p>
          <p className="text-text-secondary mt-2 text-sm leading-6">{copy.savedRecoveryBody}</p>
        </div>
        <Link
          href={localizeHref(locale, '/')}
          className="bg-accent-primary hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white transition-colors"
        >
          {copy.continueHome}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {requireCurrent ? (
        <div>
          <label
            htmlFor="update-password-current"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.currentPassword}
          </label>
          <input
            id="update-password-current"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.currentPassword)}
            className={FIELD_CLASS}
          />
          {fieldErrors.currentPassword ? (
            <p className="mt-1 text-xs font-semibold text-red-400">{fieldErrors.currentPassword}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="update-password-new"
          className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
        >
          {copy.password}
        </label>
        <input
          id="update-password-new"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          className={FIELD_CLASS}
        />
        {fieldErrors.password ? (
          <p className="mt-1 text-xs font-semibold text-red-400">{fieldErrors.password}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="update-password-confirm"
          className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
        >
          {copy.confirm}
        </label>
        <input
          id="update-password-confirm"
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={Boolean(fieldErrors.confirm)}
          className={FIELD_CLASS}
        />
        {fieldErrors.confirm ? (
          <p className="mt-1 text-xs font-semibold text-red-400">{fieldErrors.confirm}</p>
        ) : null}
      </div>

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm font-semibold ${
            notice.tone === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {notice.text}
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
