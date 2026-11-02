import type { Metadata } from 'next';
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  // El trigger `handle_new_user` crea el perfil al registrarse; si faltara la
  // fila (cuenta rota) caemos a «Mi actividad», que siempre tiene contenido.
  redirect(
    profile?.username
      ? localizeHref(locale, `/profile/${encodeURIComponent(profile.username)}`)
      : localizeHref(locale, '/me')
  );
}
