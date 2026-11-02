/**
 * Traduce el payload del Send Email Hook de GoTrue a la lista de correos a
 * mandar. Función pura: nada de env, bindings ni I/O, para testearlo entero.
 *
 * Detalles de GoTrue que gobiernan el mapeo (internal/api/mail.go):
 * - `email_change` llega en UNA sola llamada. Con Secure Email Change hay dos
 *   pares token/hash: al correo NUEVO (`user.new_email`) va el OTP `token_new`
 *   con el hash `token_hash`; al correo ACTUAL (`user.email`) va el OTP
 *   `token` con el hash `token_hash_new`. Los nombres están invertidos por
 *   compatibilidad; hay que tener cuidado con qué par va a cada dirección.
 * - Sin Secure Email Change solo se manda al correo nuevo: OTP `token`,
 *   hash `token_hash`.
 * - `email_changed_notification` se envía a la dirección ANTERIOR
 *   (`email_data.old_email`), no a la nueva.
 */
import 'server-only';
import { EmailSchema } from '@/lib/auth/identity';
import { renderAuthEmail, type AuthEmail, type AuthEmailType, type EmailLocale } from './templates';

export interface HookUser {
  email?: string;
  new_email?: string;
  user_metadata?: Record<string, unknown> | null;
}

export interface HookEmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
  old_email?: string;
  old_phone?: string;
  provider?: string;
  factor_type?: string;
}

export interface OutboundEmail extends AuthEmail {
  to: string;
}

export type PlanFailure = 'missing_recipient' | 'unsupported_type';

/**
 * `redirect_to` solo entra al enlace si apunta a quizverse.org por HTTPS: tras
 * verificar el token GoTrue redirige allí, y un http plano expondría en
 * tránsito la URL con credenciales.
 */
export function safeRedirectTo(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    return host === 'quizverse.org' || host.endsWith('.quizverse.org') ? value : null;
  } catch {
    return null;
  }
}

/**
 * Locale explícito del `redirect_to`: el path propio (`/es`, `/en`) o el `next`
 * dentro de /callback, que viaja URL-encoded. `null` si no trae señal.
 */
function redirectLocale(redirectTo: string): EmailLocale | null {
  const pathLocale = (path: string | null): EmailLocale | null => {
    if (path === '/es' || path?.startsWith('/es/')) return 'es';
    if (path === '/en' || path?.startsWith('/en/')) return 'en';
    return null;
  };
  try {
    const url = new URL(redirectTo);
    return pathLocale(url.pathname) ?? pathLocale(url.searchParams.get('next'));
  } catch {
    // No es una URL parseable: queda el chequeo literal de abajo.
  }
  const lower = redirectTo.toLowerCase();
  if (redirectTo.includes('/es') || lower.includes('%2fes')) return 'es';
  if (redirectTo.includes('/en') || lower.includes('%2fen')) return 'en';
  return null;
}

/**
 * Idioma del correo: gana el locale explícito del `redirect_to` — refleja el
 * idioma del flujo que inició el usuario, aunque su cuenta se creara en otro.
 * Sin señal en el redirect, `user_metadata` del alta
 * (`i18n`/`locale`/`language`/`preferred_locale`); si no, `en`.
 */
export function resolveEmailLocale(
  redirectTo: string | undefined,
  metadata: Record<string, unknown> | null | undefined
): EmailLocale {
  const explicit = redirectTo ? redirectLocale(redirectTo) : null;
  if (explicit) return explicit;
  for (const key of ['i18n', 'locale', 'language', 'preferred_locale']) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.toLowerCase().split(/[-_]/)[0] === 'es') {
      return 'es';
    }
  }
  return 'en';
}

/** Enlace que GoTrue canjea en su /verify: token_hash + tipo + redirect sano. */
export function buildVerifyUrl(
  verifyBaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string | undefined
): string {
  const url = new URL(verifyBaseUrl);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', type);
  const safe = redirectTo ? safeRedirectTo(redirectTo) : null;
  if (safe) url.searchParams.set('redirect_to', safe);
  return url.toString();
}

function recipient(value: string | undefined): string | null {
  const parsed = EmailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const NOTIFICATION_TYPES = new Set([
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
]);

/** Tipos que llevan enlace de verificación (el resto: OTP o solo aviso). */
const LINK_TYPES = new Set(['signup', 'recovery', 'invite', 'magiclink']);

export function planAuthEmails(
  user: HookUser,
  emailData: HookEmailData,
  verifyBaseUrl: string
): OutboundEmail[] | { error: PlanFailure } {
  const type = emailData.email_action_type;
  const locale = resolveEmailLocale(emailData.redirect_to, user.user_metadata);
  const vars = {
    provider: emailData.provider || undefined,
    factorType: emailData.factor_type || undefined,
  };
  const email = (
    to: string | null,
    tplType: AuthEmailType,
    extra: { link?: string; otp?: string; newEmail?: string } = {}
  ): OutboundEmail | null => {
    if (!to) return null;
    return { to, ...renderAuthEmail(locale, tplType, { ...vars, ...extra }) };
  };
  const verify = (tokenHash: string, actionType: string) =>
    buildVerifyUrl(verifyBaseUrl, tokenHash, actionType, emailData.redirect_to);

  if (LINK_TYPES.has(type)) {
    const to = recipient(user.email);
    if (!to) return { error: 'missing_recipient' };
    const link = verify(emailData.token_hash, type);
    return [email(to, type as AuthEmailType, { link })!];
  }

  if (type === 'reauthentication' || type === 'email') {
    // Ambos son OTP: `reauthentication` confirma identidad y `email` es el
    // código de acceso por correo (EmailOTPVerification en GoTrue).
    const to = recipient(user.email);
    if (!to) return { error: 'missing_recipient' };
    return [email(to, type, { otp: emailData.token })!];
  }

  if (type === 'email_change' || type === 'email_change_new' || type === 'email_change_current') {
    const newAddress = recipient(user.new_email);
    const currentAddress = recipient(user.email);
    const plans: OutboundEmail[] = [];

    // Al correo nuevo: hash `token_hash` (+ OTP `token_new`, o `token` cuando
    // Secure Email Change está apagado y GoTrue mueve el OTP nuevo a `token`).
    if (type !== 'email_change_current' && newAddress && emailData.token_hash) {
      plans.push(
        email(newAddress, 'email_change', {
          link: verify(emailData.token_hash, 'email_change'),
          otp: emailData.token_new || emailData.token,
          newEmail: newAddress,
        })!
      );
    }

    // Al correo actual va el segundo correo. En `email_change` (Secure Email
    // Change) su hash viaja invertido en `token_hash_new`; en los tipos
    // `_current`/`_new` (links generados por admin) llega en `token_hash`.
    if (type !== 'email_change_new' && currentAddress) {
      const currentHash = type === 'email_change' ? emailData.token_hash_new : emailData.token_hash;
      if (currentHash) {
        plans.push(
          email(currentAddress, 'email_change_current', {
            link: verify(currentHash, 'email_change'),
            otp: emailData.token,
            newEmail: newAddress ?? undefined,
          })!
        );
      }
    }

    // Borde: `email_change` sin new_email ni token_hash_new pero con dirección
    // actual y token_hash: un solo correo a la actual.
    if (plans.length === 0 && type === 'email_change' && currentAddress && emailData.token_hash) {
      plans.push(
        email(currentAddress, 'email_change', {
          link: verify(emailData.token_hash, 'email_change'),
          otp: emailData.token,
        })!
      );
    }

    return plans.length > 0 ? plans : { error: 'missing_recipient' };
  }

  if (NOTIFICATION_TYPES.has(type)) {
    // email_changed va a la dirección anterior (es quien debe enterarse).
    const to =
      type === 'email_changed_notification'
        ? (recipient(emailData.old_email) ?? recipient(user.email))
        : recipient(user.email);
    if (!to) return { error: 'missing_recipient' };
    const plan = email(to, type as AuthEmailType, { newEmail: recipient(user.email) ?? undefined });
    return plan ? [plan] : { error: 'missing_recipient' };
  }

  return { error: 'unsupported_type' };
}
