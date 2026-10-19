import type { AuthErrorCode } from '@/lib/auth/identity';
import type { Locale } from '@/lib/i18n/dictionaries';

type Copy = { en: string; es: string };

const MESSAGES: Record<AuthErrorCode | 'ok', Copy> = {
  ok: { en: 'Done.', es: 'Listo.' },
  invalid_input: {
    en: 'Check the email and the password (8 characters minimum).',
    es: 'Revisa el email y la contraseña (mínimo 8 caracteres).',
  },
  rate_limited: {
    en: 'Too many attempts. Wait a minute and try again.',
    es: 'Demasiados intentos. Espera un minuto y vuelve a probar.',
  },
  email_taken: {
    en: 'That email already has an account. Sign in instead.',
    es: 'Ese email ya tiene cuenta. Inicia sesión.',
  },
  invalid_credentials: {
    en: 'Email or password is not correct.',
    es: 'El email o la contraseña no son correctos.',
  },
  email_not_confirmed: {
    en: 'Confirm your email before signing in.',
    es: 'Confirma tu email antes de entrar.',
  },
  weak_password: {
    en: 'Choose a stronger password.',
    es: 'Elige una contraseña más fuerte.',
  },
  unauthorized: {
    en: 'Your session expired; sign in again.',
    es: 'Tu sesión caducó; inicia sesión de nuevo.',
  },
  unexpected: {
    en: 'Something went wrong. Try again in a moment.',
    es: 'Algo salió mal. Inténtalo de nuevo en un momento.',
  },
};

/** Texto de cara al usuario para un resultado de auth. */
export function authMessage(code: AuthErrorCode | 'ok', locale: Locale | string): string {
  const entry = MESSAGES[code] ?? MESSAGES.unexpected;
  return locale === 'es' ? entry.es : entry.en;
}
