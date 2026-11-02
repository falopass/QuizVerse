import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Atajo «mi perfil»: redirige al perfil público propio; nunca indexado. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Mi perfil' : 'My profile',
    description: es ? 'Tu perfil público de QuizVerse.' : 'Your public QuizVerse profile.',
    path: `/${lang}/profile`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedProfileIndexPage({
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
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/profile'))}`
      )
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const es = locale === 'es';
  if (profileError) {
    // Un error de lectura no es un perfil inexistente: se avisa y se reintenta,
    // igual que en /settings.
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 pt-28 pb-20">
        <section className="surface-card p-10 text-center">
          <h1 className="text-text-primary text-2xl font-semibold">
            {es ? 'No pudimos cargar tu perfil' : 'We could not load your profile'}
          </h1>
          <p className="text-text-secondary mt-2">
            {es ? 'Inténtalo de nuevo en unos minutos.' : 'Try again in a few minutes.'}
          </p>
          <Link
            href={localizeHref(locale, '/profile')}
            className="bg-accent-primary hover:bg-accent-hover mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium text-white transition-colors"
          >
            {es ? 'Reintentar' : 'Retry'}
          </Link>
        </section>
      </main>
    );
  }

  // El trigger `handle_new_user` crea el perfil al registrarse; si faltara la
  // fila (cuenta rota) caemos a «Mi actividad», que siempre tiene contenido.
  redirect(
    profile?.username
      ? localizeHref(locale, `/profile/${encodeURIComponent(profile.username)}`)
      : localizeHref(locale, '/me')
  );
}
