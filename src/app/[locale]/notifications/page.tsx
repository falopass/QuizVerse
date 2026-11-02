import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NotificationList } from '@/components/notifications/notification-list';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Private, login-gated inbox: never indexed. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Notificaciones' : 'Notifications',
    description: es
      ? 'Comentarios, seguidores y avisos de tu actividad en QuizVerse.'
      : 'Comments, followers and activity updates from QuizVerse.',
    path: `/${lang}/notifications`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedNotificationsPage({
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
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/notifications'))}`
      )
    );
  }

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, body, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ]);

  const es = locale === 'es';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Actividad' : 'Activity'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Notificaciones' : 'Notifications'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Comentarios en tus quizzes, nuevos seguidores y avisos de tu cuenta.'
            : 'Comments on your quizzes, new followers and account updates.'}
        </p>
      </section>
      <NotificationList
        notifications={notifications ?? []}
        unreadCount={unreadCount ?? 0}
        locale={locale}
      />
    </div>
  );
}
