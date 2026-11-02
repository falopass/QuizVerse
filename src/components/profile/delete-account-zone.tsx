'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAccountAction } from '@/actions/account.actions';
import { DELETE_ACCOUNT_CONTACT_EMAIL } from '@/lib/auth/account-deletion';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { useToast } from '@/providers/toast-provider';

const COPY = {
  es: {
    eyebrow: 'Zona de peligro',
    title: 'Eliminar mi cuenta',
    body: 'Esta acción es permanente y no se puede deshacer.',
    consequences: [
      'Se borran tu perfil, tus comentarios, tus me gusta, tus seguidores, tus notificaciones y tus logros.',
      'Tus partidas quedan anónimas: siguen contando para el quiz, pero ya no están ligadas a ti.',
      'Los quizzes que publicaste siguen disponibles con el autor «Cuenta eliminada».',
    ],
    open: 'Eliminar mi cuenta',
    confirmTitle: 'Confirma que quieres borrar tu cuenta',
    passwordLabel: 'Contraseña actual',
    confirmationLabel: (target: string) => `Escribe ${target} para confirmar`,
    confirmationHint: 'Debe coincidir exactamente con el dato que se muestra.',
    submit: 'Eliminar cuenta definitivamente',
    submitting: 'Eliminando…',
    cancel: 'Cancelar',
    unavailableTitle: 'El borrado automático no está disponible',
    unavailableBody:
      'Escríbenos desde el correo de tu cuenta y lo gestionamos contigo. No necesitas hacer nada más.',
    toastTitle: 'Cuenta eliminada',
    toastBody: 'Tu cuenta y tus datos se borraron. Cerramos tu sesión.',
    errors: {
      unauthorized: 'Tu sesión caducó; inicia sesión de nuevo.',
      invalid_input: 'Completa el campo de confirmación.',
      invalid_credentials: 'La contraseña no es correcta.',
      confirmation_mismatch: 'El texto no coincide con el dato de confirmación.',
      rate_limited: 'Demasiados intentos. Espera un minuto y vuelve a intentar.',
      unavailable: `El borrado no está disponible en este momento. Escríbenos a ${DELETE_ACCOUNT_CONTACT_EMAIL}.`,
      unexpected: `No pudimos borrar la cuenta. Inténtalo de nuevo o escríbenos a ${DELETE_ACCOUNT_CONTACT_EMAIL}.`,
    },
  },
  en: {
    eyebrow: 'Danger zone',
    title: 'Delete my account',
    body: 'This action is permanent and cannot be undone.',
    consequences: [
      'Your profile, comments, likes, follows, notifications and achievements are deleted.',
      'Your game sessions become anonymous: they still count for the quiz, but they are no longer linked to you.',
      'Quizzes you published stay available under the author “Deleted account”.',
    ],
    open: 'Delete my account',
    confirmTitle: 'Confirm that you want to delete your account',
    passwordLabel: 'Current password',
    confirmationLabel: (target: string) => `Type ${target} to confirm`,
    confirmationHint: 'It must match the value shown exactly.',
    submit: 'Delete account permanently',
    submitting: 'Deleting…',
    cancel: 'Cancel',
    unavailableTitle: 'Automatic deletion is not available',
    unavailableBody:
      'Email us from your account address and we will handle it with you. You do not need to do anything else.',
    toastTitle: 'Account deleted',
    toastBody: 'Your account and data were deleted. We signed you out.',
    errors: {
      unauthorized: 'Your session expired; sign in again.',
      invalid_input: 'Fill in the confirmation field.',
      invalid_credentials: 'That password is not correct.',
      confirmation_mismatch: 'The text does not match the confirmation value.',
      rate_limited: 'Too many attempts. Wait a minute and try again.',
      unavailable: `Deletion is not available right now. Email us at ${DELETE_ACCOUNT_CONTACT_EMAIL}.`,
      unexpected: `We could not delete the account. Try again or email us at ${DELETE_ACCOUNT_CONTACT_EMAIL}.`,
    },
  },
} as const;

const FIELD_CLASS =
  'border-border-subtle bg-bg-primary text-text-primary focus:border-accent-primary w-full rounded-full border px-4 py-3 text-sm outline-none';

/**
 * Zona de peligro de /settings.
 *
 * Dos pasos: el botón revela el formulario y solo el segundo envío llama a la
 * acción. La revalidación real ocurre en el servidor: aquí la contraseña o la
 * frase solo viajan, nunca se comparan. Con la key de service role sin
 * configurar, el formulario no se muestra y queda el correo de contacto.
 */
export function DeleteAccountZone({
  locale,
  hasEmailIdentity,
  confirmationTarget,
  available,
}: {
  locale: Locale;
  hasEmailIdentity: boolean;
  /** Username (o email) que la cuenta solo-OAuth debe escribir. */
  confirmationTarget: string;
  available: boolean;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useSupabase();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusTriggerOnClose = useRef(false);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (focusTriggerOnClose.current) {
      focusTriggerOnClose.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    let result;
    try {
      result = await deleteAccountAction(
        hasEmailIdentity ? { password: value } : { confirmation: value }
      );
    } catch {
      result = { ok: false as const, code: 'unexpected' as const };
    }
    setLoading(false);

    if (result.ok) {
      toast.success(copy.toastTitle, copy.toastBody);
      // El servidor ya cerró la sesión; esto limpia la que el provider aún
      // tiene en memoria para que el menú no siga mostrando la cuenta.
      try {
        await signOut();
      } catch {
        // La cuenta ya no existe: la navegación no se bloquea por esto.
      }
      router.replace(localizeHref(locale, '/'));
      return;
    }
    setError(copy.errors[result.code] ?? copy.errors.unexpected);
  }

  return (
    <section
      className="surface-card border-error/30 mt-8 border p-6 md:p-8"
      aria-labelledby="delete-account-heading"
    >
      <p className="eyebrow text-error">{copy.eyebrow}</p>
      <h2
        id="delete-account-heading"
        className="text-text-primary mt-2 text-2xl font-semibold tracking-tight"
      >
        {copy.title}
      </h2>
      <p className="text-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
      <ul className="text-text-secondary mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
        {copy.consequences.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {!available ? (
        <div className="border-border-subtle bg-bg-primary mt-6 rounded-2xl border p-4">
          <p className="text-text-primary text-sm font-semibold">{copy.unavailableTitle}</p>
          <p className="text-text-secondary mt-1 text-sm leading-6">
            {copy.unavailableBody}{' '}
            <a
              href={`mailto:${DELETE_ACCOUNT_CONTACT_EMAIL}`}
              className="text-accent-primary hover:text-accent-hover underline"
            >
              {DELETE_ACCOUNT_CONTACT_EMAIL}
            </a>
          </p>
        </div>
      ) : !open ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="border-error/40 text-error hover:bg-error/10 mt-6 rounded-full border px-5 py-3 text-sm font-semibold transition-colors"
        >
          {copy.open}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="border-error/20 mt-6 space-y-4 border-t pt-6">
          <h3 className="text-text-primary text-lg font-semibold">{copy.confirmTitle}</h3>

          <div>
            <label
              htmlFor="delete-account-confirmation"
              className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
            >
              {hasEmailIdentity ? copy.passwordLabel : copy.confirmationLabel(confirmationTarget)}
            </label>
            <input
              ref={inputRef}
              id="delete-account-confirmation"
              type={hasEmailIdentity ? 'password' : 'text'}
              autoComplete={hasEmailIdentity ? 'current-password' : 'off'}
              spellCheck={false}
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-describedby={hasEmailIdentity ? undefined : 'delete-account-confirmation-hint'}
              className={FIELD_CLASS}
            />
            {hasEmailIdentity ? null : (
              <p id="delete-account-confirmation-hint" className="text-text-muted mt-1 text-xs">
                {copy.confirmationHint}
              </p>
            )}
          </div>

          {error ? (
            <p role="alert" className="text-error text-sm font-semibold">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="bg-error text-bg-primary rounded-full px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
            >
              {loading ? copy.submitting : copy.submit}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                focusTriggerOnClose.current = true;
                setOpen(false);
                setValue('');
                setError(null);
              }}
              className="border-border-subtle text-text-secondary hover:text-text-primary rounded-full border px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
