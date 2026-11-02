/**
 * Plantillas de correos de auth (Send Email Hook de GoTrue).
 *
 * Español neutro sin voseo e inglés; HTML simple y accesible (sin imágenes
 * remotas, tabla de ancho fijo) con versión de texto plano equivalente.
 * `renderAuthEmail` devuelve asunto + cuerpo para un tipo y un idioma.
 *
 * Los textos interpolados (`newEmail`, `token`, URLs) se escapan antes de
 * entrar al HTML: vienen del payload del hook y nada de ellos se inserta crudo.
 */

export type EmailLocale = 'en' | 'es';

/**
 * Tipos que llevan enlace de verificación, código OTP o solo aviso.
 * `email_change_current` es la copia que va a la dirección anterior cuando
 * GoTrue manda el par de correos de `email_change` (Secure Email Change).
 */
export type AuthEmailType =
  | 'signup'
  | 'recovery'
  | 'invite'
  | 'magiclink'
  | 'email'
  | 'email_change'
  | 'email_change_current'
  | 'reauthentication'
  | 'password_changed_notification'
  | 'email_changed_notification'
  | 'phone_changed_notification'
  | 'identity_linked_notification'
  | 'identity_unlinked_notification'
  | 'mfa_factor_enrolled_notification'
  | 'mfa_factor_unenrolled_notification';

export interface AuthEmailVars {
  /** Enlace de verificación (tipos con enlace). */
  link?: string;
  /** Código OTP (reauthentication y alternativa en `email`). */
  otp?: string;
  /** Dirección nueva en los correos de email_change. */
  newEmail?: string;
  /** Proveedor en identity_linked/unlinked. */
  provider?: string;
  /** Tipo de factor en mfa_factor_enrolled/unenrolled. */
  factorType?: string;
}

export interface AuthEmail {
  subject: string;
  html: string;
  text: string;
}

const SITE_URL = 'https://quizverse.org';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

interface Copy {
  subject: string;
  title: string;
  body: string;
  /** Texto del botón cuando el correo lleva enlace. */
  cta?: string;
  /** Línea que precede al código OTP. */
  otpLead?: string;
  /** Aviso de seguridad al pie («si no fuiste tú…»). */
  note?: string;
}

const EN: Record<AuthEmailType, Copy> = {
  signup: {
    subject: 'Confirm your QuizVerse account',
    title: 'Confirm your account',
    body: 'Thanks for signing up for QuizVerse. Confirm this email address to activate your account:',
    cta: 'Confirm email address',
    note: 'If you didn’t create an account, you can ignore this email.',
  },
  recovery: {
    subject: 'Reset your QuizVerse password',
    title: 'Reset your password',
    body: 'We received a request to reset the password for your QuizVerse account. Use the link below to choose a new one:',
    cta: 'Reset password',
    note: 'If you didn’t request this, you can ignore this email — your password won’t change.',
  },
  invite: {
    subject: 'You’ve been invited to QuizVerse',
    title: 'You’ve been invited',
    body: 'You were invited to create a QuizVerse account. Accept the invitation:',
    cta: 'Accept invitation',
    note: 'If you weren’t expecting this invitation, you can ignore this email.',
  },
  magiclink: {
    subject: 'Your QuizVerse sign-in link',
    title: 'Your sign-in link',
    body: 'Use the link below to sign in to QuizVerse. It expires soon and only works once:',
    cta: 'Sign in',
    note: 'If you didn’t request this link, you can ignore this email.',
  },
  email: {
    subject: 'Your QuizVerse sign-in code',
    title: 'Your sign-in code',
    body: 'Use the code below to sign in to QuizVerse. It expires soon:',
    otpLead: 'Your code:',
    note: 'If you didn’t request this code, you can ignore this email.',
  },
  email_change: {
    subject: 'Confirm your new email address',
    title: 'Confirm your new email address',
    body: 'You asked to change the email on your QuizVerse account to {newEmail}. Confirm the new address:',
    cta: 'Confirm new email',
    note: 'If you didn’t request this change, you can ignore this email.',
  },
  email_change_current: {
    subject: 'Confirm the email change on your QuizVerse account',
    title: 'Confirm the email change',
    body: 'A request was made to change the email on your QuizVerse account to {newEmail}. Confirm the change from this address:',
    cta: 'Confirm email change',
    note: 'If you didn’t request this change, ignore this email and your address will stay the same.',
  },
  reauthentication: {
    subject: '{otp} is your QuizVerse verification code',
    title: 'Your verification code',
    body: 'Use the code below to confirm your identity. It expires soon:',
    otpLead: 'Your code:',
    note: 'If you didn’t request this code, you can ignore this email.',
  },
  password_changed_notification: {
    subject: 'Your QuizVerse password was changed',
    title: 'Your password was changed',
    body: 'The password on your QuizVerse account was just changed.',
    note: 'If this wasn’t you, reset your password right away from {siteUrl}.',
  },
  email_changed_notification: {
    subject: 'Your QuizVerse email was changed',
    title: 'Your email was changed',
    body: 'The email on your QuizVerse account was just changed to {newEmail}.',
    note: 'If this wasn’t you, contact support through {siteUrl} right away.',
  },
  phone_changed_notification: {
    subject: 'Your QuizVerse phone was changed',
    title: 'Your phone was changed',
    body: 'The phone number on your QuizVerse account was just changed.',
    note: 'If this wasn’t you, contact support through {siteUrl} right away.',
  },
  identity_linked_notification: {
    subject: 'A sign-in method was linked to your QuizVerse account',
    title: 'A sign-in method was linked',
    body: 'A {provider} sign-in method was just linked to your QuizVerse account.',
    note: 'If this wasn’t you, review your account security at {siteUrl}.',
  },
  identity_unlinked_notification: {
    subject: 'A sign-in method was unlinked from your QuizVerse account',
    title: 'A sign-in method was unlinked',
    body: 'A {provider} sign-in method was just unlinked from your QuizVerse account.',
    note: 'If this wasn’t you, review your account security at {siteUrl} right away.',
  },
  mfa_factor_enrolled_notification: {
    subject: 'A multi-factor method was added to your QuizVerse account',
    title: 'A multi-factor method was added',
    body: 'A multi-factor authentication method ({factorType}) was just added to your QuizVerse account.',
    note: 'If this wasn’t you, review your account security at {siteUrl} right away.',
  },
  mfa_factor_unenrolled_notification: {
    subject: 'A multi-factor method was removed from your QuizVerse account',
    title: 'A multi-factor method was removed',
    body: 'A multi-factor authentication method ({factorType}) was just removed from your QuizVerse account.',
    note: 'If this wasn’t you, review your account security at {siteUrl} right away.',
  },
};

const ES: Record<AuthEmailType, Copy> = {
  signup: {
    subject: 'Confirma tu cuenta de QuizVerse',
    title: 'Confirma tu cuenta',
    body: 'Gracias por registrarte en QuizVerse. Confirma este correo para activar tu cuenta:',
    cta: 'Confirmar correo',
    note: 'Si no creaste una cuenta, puedes ignorar este correo.',
  },
  recovery: {
    subject: 'Restablece tu contraseña de QuizVerse',
    title: 'Restablece tu contraseña',
    body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de QuizVerse. Usa el enlace para elegir una nueva:',
    cta: 'Restablecer contraseña',
    note: 'Si no solicitaste este cambio, puedes ignorar este correo: tu contraseña seguirá igual.',
  },
  invite: {
    subject: 'Te invitaron a QuizVerse',
    title: 'Te invitaron',
    body: 'Te invitaron a crear una cuenta en QuizVerse. Acepta la invitación:',
    cta: 'Aceptar invitación',
    note: 'Si no esperabas esta invitación, puedes ignorar este correo.',
  },
  magiclink: {
    subject: 'Tu enlace de acceso a QuizVerse',
    title: 'Tu enlace de acceso',
    body: 'Usa el enlace para entrar a QuizVerse. Caduca pronto y solo funciona una vez:',
    cta: 'Entrar',
    note: 'Si no solicitaste este enlace, puedes ignorar este correo.',
  },
  email: {
    subject: 'Tu código de acceso a QuizVerse',
    title: 'Tu código de acceso',
    body: 'Usa este código para entrar a QuizVerse. Caduca pronto:',
    otpLead: 'Tu código:',
    note: 'Si no solicitaste este código, puedes ignorar este correo.',
  },
  email_change: {
    subject: 'Confirma tu nueva dirección de correo',
    title: 'Confirma tu nueva dirección de correo',
    body: 'Pediste cambiar el correo de tu cuenta de QuizVerse a {newEmail}. Confirma la nueva dirección:',
    cta: 'Confirmar nuevo correo',
    note: 'Si no pediste este cambio, puedes ignorar este correo.',
  },
  email_change_current: {
    subject: 'Confirma el cambio de correo de tu cuenta de QuizVerse',
    title: 'Confirma el cambio de correo',
    body: 'Se pidió cambiar el correo de tu cuenta de QuizVerse a {newEmail}. Confirma el cambio desde esta dirección:',
    cta: 'Confirmar cambio de correo',
    note: 'Si no pediste este cambio, ignora este correo y tu dirección seguirá igual.',
  },
  reauthentication: {
    subject: '{otp} es tu código de verificación de QuizVerse',
    title: 'Tu código de verificación',
    body: 'Usa este código para confirmar tu identidad. Caduca pronto:',
    otpLead: 'Tu código:',
    note: 'Si no solicitaste este código, puedes ignorar este correo.',
  },
  password_changed_notification: {
    subject: 'Tu contraseña de QuizVerse cambió',
    title: 'Tu contraseña cambió',
    body: 'La contraseña de tu cuenta de QuizVerse acaba de cambiar.',
    note: 'Si no fuiste tú, restablece tu contraseña de inmediato en {siteUrl}.',
  },
  email_changed_notification: {
    subject: 'Tu correo de QuizVerse cambió',
    title: 'Tu correo cambió',
    body: 'El correo de tu cuenta de QuizVerse acaba de cambiar a {newEmail}.',
    note: 'Si no fuiste tú, escribe a soporte desde {siteUrl} de inmediato.',
  },
  phone_changed_notification: {
    subject: 'Tu teléfono de QuizVerse cambió',
    title: 'Tu teléfono cambió',
    body: 'El número de teléfono de tu cuenta de QuizVerse acaba de cambiar.',
    note: 'Si no fuiste tú, escribe a soporte desde {siteUrl} de inmediato.',
  },
  identity_linked_notification: {
    subject: 'Vincularon un método de acceso a tu cuenta de QuizVerse',
    title: 'Vincularon un método de acceso',
    body: 'Se acaba de vincular un método de acceso {provider} a tu cuenta de QuizVerse.',
    note: 'Si no fuiste tú, revisa la seguridad de tu cuenta en {siteUrl}.',
  },
  identity_unlinked_notification: {
    subject: 'Desvincularon un método de acceso de tu cuenta de QuizVerse',
    title: 'Desvincularon un método de acceso',
    body: 'Se acaba de desvincular un método de acceso {provider} de tu cuenta de QuizVerse.',
    note: 'Si no fuiste tú, revisa la seguridad de tu cuenta en {siteUrl} de inmediato.',
  },
  mfa_factor_enrolled_notification: {
    subject: 'Agregaron un método de verificación a tu cuenta de QuizVerse',
    title: 'Agregaron un método de verificación',
    body: 'Se acaba de agregar un método de verificación en dos pasos ({factorType}) a tu cuenta de QuizVerse.',
    note: 'Si no fuiste tú, revisa la seguridad de tu cuenta en {siteUrl} de inmediato.',
  },
  mfa_factor_unenrolled_notification: {
    subject: 'Quitaron un método de verificación de tu cuenta de QuizVerse',
    title: 'Quitaron un método de verificación',
    body: 'Se acaba de quitar un método de verificación en dos pasos ({factorType}) de tu cuenta de QuizVerse.',
    note: 'Si no fuiste tú, revisa la seguridad de tu cuenta en {siteUrl} de inmediato.',
  },
};

const COPIES: Record<EmailLocale, Record<AuthEmailType, Copy>> = { en: EN, es: ES };

const FOOTER = {
  en: 'You’re getting this email because of activity on your QuizVerse account.',
  es: 'Recibes este correo por actividad en tu cuenta de QuizVerse.',
};

function htmlPage(
  locale: EmailLocale,
  copy: Copy,
  vars: Record<string, string | undefined>
): string {
  const link = vars.link;
  const otp = vars.otp;
  const button = link
    ? `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#8458ff;color:#ffffff;font-size:16px;font-weight:700;line-height:1;padding:14px 28px;border-radius:8px;text-decoration:none;">${escapeHtml(copy.cta ?? 'Open')}</a></p>` +
      `<p style="margin:0 0 8px;font-size:13px;color:#4b5563;word-break:break-all;">${locale === 'es' ? 'Si el botón no funciona, abre este enlace:' : 'If the button doesn’t work, open this link:'}<br><a href="${link}" style="color:#8458ff;">${link}</a></p>`
    : '';
  const code = otp
    ? `<p style="margin:16px 0 4px;font-size:14px;color:#4b5563;">${escapeHtml(copy.otpLead ?? '')}</p><p style="margin:0;font-size:32px;font-weight:700;letter-spacing:6px;color:#101019;">${escapeHtml(otp)}</p>`
    : '';
  const note = copy.note
    ? `<p style="margin:24px 0 0;font-size:13px;color:#6b7280;">${copy.note}</p>`
    : '';

  return [
    '<!doctype html>',
    `<html lang="${locale}">`,
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' +
      escapeHtml(copy.subject) +
      '</title></head>',
    '<body style="margin:0;padding:0;background:#f4f4f8;">',
    '<div role="article" style="max-width:560px;margin:0 auto;padding:32px 16px;font-family:system-ui,-apple-system,\'Segoe UI\',Roboto,Arial,sans-serif;">',
    '<p style="margin:0 0 16px;font-size:18px;font-weight:800;color:#8458ff;letter-spacing:0.5px;">QuizVerse</p>',
    '<div style="background:#ffffff;border-radius:12px;padding:28px 24px;">',
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#101019;">${copy.title}</h1>`,
    `<p style="margin:0;font-size:15px;line-height:1.55;color:#374151;">${copy.body}</p>`,
    button,
    code,
    note,
    '</div>',
    `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">${FOOTER[locale]}<br><a href="${SITE_URL}" style="color:#8458ff;text-decoration:none;">quizverse.org</a></p>`,
    '</div>',
    '</body>',
    '</html>',
  ].join('\n');
}

function textPage(
  locale: EmailLocale,
  copy: Copy,
  vars: Record<string, string | undefined>
): string {
  const lines = [`QuizVerse — ${copy.title}`, '', copy.body];
  if (vars.link) lines.push('', vars.link);
  if (vars.otp) lines.push('', `${copy.otpLead ?? ''} ${vars.otp}`.trim());
  if (copy.note) lines.push('', copy.note);
  lines.push('', `${FOOTER[locale]}`, SITE_URL);
  return lines.join('\n');
}

export function renderAuthEmail(
  locale: EmailLocale,
  type: AuthEmailType,
  vars: AuthEmailVars
): AuthEmail {
  const copy = COPIES[locale][type];
  // Valores para el texto plano (sin escapar) y para el HTML (escapados). El
  // enlace ya viene construido por nosotros: solo hace falta escapar `&` en el
  // atributo href y en el texto visible.
  const fallbackNewEmail = locale === 'es' ? 'la nueva dirección' : 'the new address';
  const rawNewEmail = vars.newEmail ?? fallbackNewEmail;
  const textVars: Record<string, string> = {
    otp: vars.otp ?? '',
    newEmail: rawNewEmail,
    provider: vars.provider ?? 'OAuth',
    factorType: vars.factorType ?? 'totp',
    siteUrl: SITE_URL,
  };
  const htmlVars: Record<string, string> = {
    ...textVars,
    otp: escapeHtml(textVars.otp),
    newEmail: `<strong>${escapeHtml(rawNewEmail)}</strong>`,
    provider: escapeHtml(textVars.provider),
    factorType: escapeHtml(textVars.factorType),
  };
  const link = vars.link ? escapeHtml(vars.link) : undefined;

  const subject = interpolate(copy.subject, textVars);
  const htmlCopy: Copy = {
    ...copy,
    subject,
    title: interpolate(copy.title, htmlVars),
    body: interpolate(copy.body, htmlVars),
    note: copy.note ? interpolate(copy.note, htmlVars) : undefined,
    otpLead: copy.otpLead,
  };
  const textCopy: Copy = {
    ...copy,
    subject,
    title: interpolate(copy.title, textVars),
    body: interpolate(copy.body, textVars),
    note: copy.note ? interpolate(copy.note, textVars) : undefined,
    otpLead: copy.otpLead,
  };

  return {
    subject,
    html: htmlPage(locale, htmlCopy, { link, otp: vars.otp }),
    text: textPage(locale, textCopy, { link: vars.link, otp: vars.otp }),
  };
}
