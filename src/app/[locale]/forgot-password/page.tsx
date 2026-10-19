import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Recuperar contraseña' : 'Reset your password',
    description: es
      ? 'Pide un enlace por correo para crear una contraseña nueva de QuizVerse.'
      : 'Request an email link to set a new QuizVerse password.',
    path: `/${lang}/forgot-password`,
    locale: lang,
    noindex: true,
    follow: false,
  });
}

export default async function LocalizedForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const [{ locale }, { email }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();
  const es = locale === 'es';

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pt-28 pb-20">
      <section className="surface-card p-8 md:p-10">
        <p className="eyebrow">{es ? 'Cuenta' : 'Account'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight">
          {es ? 'Recuperar contraseña' : 'Reset your password'}
        </h1>
        <p className="text-text-secondary mt-3 text-sm leading-6">
          {es
            ? 'Te enviamos un enlace por correo para crear una contraseña nueva.'
            : 'We will email you a link to set a new password.'}
        </p>
        <div className="mt-8">
          <ForgotPasswordForm locale={locale} initialEmail={email ?? ''} />
        </div>
      </section>
    </main>
  );
}
