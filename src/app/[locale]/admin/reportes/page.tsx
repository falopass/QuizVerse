import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ReportList, type AdminReport } from '@/components/admin/report-list';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Cola de moderación, privada: nunca indexada. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Reportes' : 'Reports',
    description: es
      ? 'Cola de moderación: quizzes reportados por revisar.'
      : 'Moderation queue: reported quizzes pending review.',
    path: `/${lang}/admin/reportes`,
    locale: lang,
    noindex: true,
  });
}

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/admin/reportes'))}`
      )
    );
  }
  if (!isAdmin) notFound();

  const { data } = await supabase
    .from('quiz_reports')
    .select(
      'id, reason, details, reporter_id, created_at, quizzes(id, slug, title, status, language)'
    )
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(100);

  const reports: AdminReport[] = (data ?? []).map((report) => ({
    id: report.id,
    reason: report.reason,
    details: report.details,
    reporter_id: report.reporter_id,
    created_at: report.created_at,
    quiz: Array.isArray(report.quizzes) ? (report.quizzes[0] ?? null) : report.quizzes,
  }));

  const es = locale === 'es';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Moderación' : 'Moderation'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Reportes' : 'Reports'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Quizzes reportados por la comunidad, pendientes de revisión.'
            : 'Quizzes reported by the community, pending review.'}
        </p>
      </section>
      <ReportList reports={reports} locale={locale} />
    </div>
  );
}
