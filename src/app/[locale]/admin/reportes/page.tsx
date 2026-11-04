import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ReportList, type AdminReport } from '@/components/admin/report-list';
import { CommentReportList, type AdminCommentReport } from '@/components/admin/comment-report-list';
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
      ? 'Cola de moderación: quizzes y comentarios reportados por revisar.'
      : 'Moderation queue: reported quizzes and comments pending review.',
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

  const baseQuery = (columns: string) =>
    supabase
      .from('quiz_reports')
      .select(columns)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(100);

  // El snapshot (quiz_title/quiz_slug) llega con la migración 016; si aún no
  // está aplicada la select revienta y se reintenta sin él.
  const quizReportsPromise = baseQuery(
    'id, reason, details, reporter_id, created_at, quiz_title, quiz_slug, quizzes(id, slug, title, status, language)'
  );
  // `comment_reports` nace en la migración 017: si aún no se aplicó, la
  // consulta falla y la sección sale vacía en vez de romper la página.
  const commentReportsPromise = supabase
    .from('comment_reports')
    .select(
      'id, reason, details, reporter_id, created_at, comment_id, comment_body, quizzes(id, slug, title, status, language)'
    )
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(100);

  let result = await quizReportsPromise;
  if (result.error) {
    result = (await baseQuery(
      'id, reason, details, reporter_id, created_at, quizzes(id, slug, title, status, language)'
    )) as typeof result;
  }
  const { data: commentData } = await commentReportsPromise;

  interface ReportRow {
    id: string;
    reason: AdminReport['reason'];
    details: string | null;
    reporter_id: string | null;
    created_at: string;
    quiz_title?: string | null;
    quiz_slug?: string | null;
    quizzes: AdminReport['quiz'] | AdminReport['quiz'][];
  }

  const reports: AdminReport[] = ((result.data ?? []) as unknown as ReportRow[]).map((report) => ({
    id: report.id,
    reason: report.reason,
    details: report.details,
    reporter_id: report.reporter_id,
    created_at: report.created_at,
    quiz_title: report.quiz_title ?? null,
    quiz_slug: report.quiz_slug ?? null,
    quiz: Array.isArray(report.quizzes) ? (report.quizzes[0] ?? null) : report.quizzes,
  }));

  const commentReports: AdminCommentReport[] = (commentData ?? []).map((report) => ({
    id: report.id,
    reason: report.reason,
    details: report.details,
    reporter_id: report.reporter_id,
    created_at: report.created_at,
    comment_id: report.comment_id,
    comment_body: report.comment_body,
    quiz: Array.isArray(report.quizzes) ? (report.quizzes[0] ?? null) : report.quizzes,
  }));

  const es = locale === 'es';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{es ? 'Moderación' : 'Moderation'}</p>
            <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
              {es ? 'Reportes' : 'Reports'}
            </h1>
            <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
              {es
                ? 'Quizzes y comentarios reportados por la comunidad, pendientes de revisión.'
                : 'Quizzes and comments reported by the community, pending review.'}
            </p>
          </div>
          <nav aria-label="Admin" className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
            <Link
              href={localizeHref(locale, '/admin/moderacion')}
              className="text-accent-primary hover:text-accent-hover inline-flex min-h-11 items-center transition-colors"
            >
              {es ? 'Ver cola de moderación' : 'View moderation queue'}
            </Link>
            <Link
              href={localizeHref(locale, '/admin/estadisticas')}
              className="text-accent-primary hover:text-accent-hover inline-flex min-h-11 items-center transition-colors"
            >
              {es ? 'Estadísticas' : 'Statistics'}
            </Link>
          </nav>
        </div>
      </section>
      <ReportList reports={reports} locale={locale} />
      <CommentReportList reports={commentReports} locale={locale} />
    </div>
  );
}
