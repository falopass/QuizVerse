import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
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
 * Destino del enlace de recuperación. `/callback` ya canjeó el código y dejó
 * una sesión activa; sin ella el enlace está usado o vencido y solo queda
 * pedir otro.
 */
export default async function LocalizedResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const es = locale === 'es';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pt-28 pb-20">
      <section className="surface-card p-8 md:p-10">
        <p className="eyebrow">{es ? 'Cuenta' : 'Account'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight">
          {es ? 'Nueva contraseña' : 'New password'}
        </h1>
        {user ? (
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
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-text-secondary text-sm leading-6">
              {es
                ? 'El enlace ya no sirve: puede haber vencido o ya estar usado. Pide uno nuevo.'
                : 'That link no longer works: it may have expired or already been used. Request a new one.'}
            </p>
            <Link
              href={localizeHref(locale, '/forgot-password')}
              className="bg-accent-primary hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              {es ? 'Pedir un enlace nuevo' : 'Request a new link'}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
