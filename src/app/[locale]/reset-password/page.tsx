import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import {
  RECOVERY_COOKIE_NAME,
  sessionIdFromAccessToken,
  verifyRecoveryChallenge,
} from '@/lib/auth/password-recovery';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Nueva contraseña' : 'New password',
    description: es
      ? 'Crea una contraseña nueva para tu cuenta de QuizVerse.'
      : 'Set a new password for your QuizVerse account.',
    path: `/${lang}/reset-password`,
    locale: lang,
    noindex: true,
    follow: false,
  });
}

/**
 * Destino del enlace de recuperación.
 *
 * Solo habilita el formulario cuando coexisten la sesión autenticada y la
 * cookie HttpOnly del desafío de recuperación emitido por `/callback` (vigente
 * y sin consumir). Una sesión ordinaria no abre la recuperación: redirige a
 * `/settings` (cambio con contraseña actual) o a pedir un enlace nuevo.
 */
export default async function LocalizedResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ error?: string }>({}),
  ]);
  if (!hasLocale(locale)) notFound();
  const es = locale === 'es';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasValidRecovery = false;
  let ordinarySession = false;

  if (user && query.error !== 'expired') {
    const sessionResult =
      typeof supabase.auth.getSession === 'function' ? await supabase.auth.getSession() : null;
    const sessionId = sessionIdFromAccessToken(sessionResult?.data?.session?.access_token);
    const cookieStore = await cookies();
    const token = cookieStore.get(RECOVERY_COOKIE_NAME)?.value;
    const verified = await verifyRecoveryChallenge(token, { userId: user.id, sessionId });
    hasValidRecovery = verified.ok;
    ordinarySession = !verified.ok && verified.reason === 'missing';
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pt-28 pb-20">
      <section className="surface-card p-8 md:p-10">
        <p className="eyebrow">{es ? 'Cuenta' : 'Account'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight">
          {es ? 'Nueva contraseña' : 'New password'}
        </h1>
        {hasValidRecovery ? (
          <>
            <p className="text-text-secondary mt-3 text-sm leading-6">
              {es
                ? 'Elige una contraseña nueva para tu cuenta.'
                : 'Choose a new password for your account.'}
            </p>
            <div className="mt-8">
              <UpdatePasswordForm locale={locale} mode="recovery" />
            </div>
          </>
        ) : ordinarySession ? (
          <div className="mt-6 space-y-4">
            <p className="text-text-secondary text-sm leading-6">
              {es
                ? 'Para cambiar tu contraseña con la sesión abierta, hazlo desde los ajustes de tu cuenta. Esta página solo funciona desde un enlace de recuperación enviado por correo.'
                : 'To change your password while signed in, use your account settings. This page only works from a recovery link sent by email.'}
            </p>
            <Link
              href={localizeHref(locale, '/settings')}
              className="bg-accent-primary hover:bg-accent-hover text-bg-primary inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition-colors"
            >
              {es ? 'Ir a ajustes de cuenta' : 'Go to account settings'}
            </Link>
            <Link
              href={localizeHref(locale, '/forgot-password')}
              className="border-border-subtle text-text-primary hover:border-accent-primary/40 inline-flex w-full items-center justify-center rounded-full border px-4 py-3 text-sm font-semibold transition-colors"
            >
              {es ? 'Pedir un enlace de recuperación' : 'Request a recovery link'}
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-text-secondary text-sm leading-6">
              {es
                ? 'El enlace ya no sirve: puede haber vencido o ya estar usado. Pide uno nuevo.'
                : 'That link no longer works: it may have expired or already been used. Request a new one.'}
            </p>
            <Link
              href={localizeHref(locale, '/forgot-password')}
              className="bg-accent-primary hover:bg-accent-hover text-bg-primary inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition-colors"
            >
              {es ? 'Pedir un enlace nuevo' : 'Request a new link'}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
