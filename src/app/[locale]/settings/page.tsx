import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { SettingsForm } from '@/components/profile/settings-form';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { createClient } from '@/lib/supabase/server';

/** Login-gated personal page: anonymous visitors get redirected to sign in. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Ajustes de perfil' : 'Profile settings',
    description: es
      ? 'Edita tu nombre visible, usuario y bio de QuizVerse.'
      : 'Edit your QuizVerse display name, username and bio.',
    path: `/${lang}/settings`,
    locale: lang,
    noindex: true,
    follow: false,
  });
}

export default async function LocalizedSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/settings'))}`
      )
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username, display_name, bio')
    .eq('id', user.id)
    .maybeSingle();

  const es = locale === 'es';
  // Fila inexistente o error de lectura: el formulario vacío sería insalvable
  // (update de 0 filas no falla en el action) y `required` bloquearía el envío.
  const profileFailed = profileError !== null || !profile;
  // Cuentas solo-OAuth (Google/GitHub) no tienen clave vigente que revalidar.
  const hasEmailIdentity =
    user.identities?.some((identity) => identity.provider === 'email') ?? false;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Cuenta' : 'Account'}</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-text-primary text-4xl font-semibold tracking-tight md:text-5xl">
            {es ? 'Ajustes de perfil' : 'Profile settings'}
          </h1>
          {profile?.username ? (
            <Link
              href={localizeHref(locale, `/profile/${profile.username}`)}
              className="text-accent-primary text-sm font-semibold hover:underline"
            >
              {es ? 'Ver mi perfil público' : 'View my public profile'}
            </Link>
          ) : null}
        </div>
      </section>

      <div className="surface-card mt-8 p-6 md:p-8">
        {profileFailed ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-text-secondary text-sm">
              {es
                ? 'No pudimos cargar tu perfil. Inténtalo de nuevo en unos minutos.'
                : 'We could not load your profile. Try again in a few minutes.'}
            </p>
            <Link
              href={localizeHref(locale, '/settings')}
              className="text-accent-primary text-sm font-semibold hover:underline"
            >
              {es ? 'Reintentar' : 'Retry'}
            </Link>
          </div>
        ) : (
          <SettingsForm
            locale={locale}
            initialDisplayName={profile.display_name ?? ''}
            initialUsername={profile.username}
            initialBio={profile.bio ?? ''}
          />
        )}
      </div>

      <div className="surface-card mt-8 p-6 md:p-8">
        <h2 className="text-text-primary text-2xl font-semibold tracking-tight">
          {es ? 'Contraseña' : 'Password'}
        </h2>
        <p className="text-text-secondary mt-2 text-sm leading-6">
          {hasEmailIdentity
            ? es
              ? 'Cambia la contraseña con la que entras por email.'
              : 'Change the password you use to sign in with email.'
            : es
              ? 'Define una contraseña para también poder entrar con tu email.'
              : 'Set a password so you can also sign in with your email.'}
        </p>
        <div className="mt-6">
          <UpdatePasswordForm locale={locale} mode="settings" requireCurrent={hasEmailIdentity} />
        </div>
      </div>
    </main>
  );
}
