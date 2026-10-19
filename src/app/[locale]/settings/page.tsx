import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio')
    .eq('id', user.id)
    .maybeSingle();

  const es = locale === 'es';

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
        <SettingsForm
          locale={locale}
          initialDisplayName={profile?.display_name ?? ''}
          initialUsername={profile?.username ?? ''}
          initialBio={profile?.bio ?? ''}
        />
      </div>
    </main>
  );
}
