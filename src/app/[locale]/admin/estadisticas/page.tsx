import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createServiceClient } from '@/lib/supabase/service';
import {
  loadAdminStats,
  shareOf,
  type AdminStats,
  type GroupCount,
  type TopQuiz,
} from '@/lib/admin/stats';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatNumber } from '@/lib/utils/format';
import type { QuizType } from '@/types/database';

/** Panel de solo lectura, privado: nunca indexado. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Estadísticas del sitio' : 'Site statistics',
    description: es
      ? 'Panel interno de solo lectura: catálogo, partidas, tops y cuentas.'
      : 'Internal read-only dashboard: catalog, plays, tops and accounts.',
    path: `/${lang}/admin/estadisticas`,
    locale: lang,
    noindex: true,
  });
}

const COPY = {
  es: {
    eyebrow: 'Administración',
    title: 'Estadísticas del sitio',
    intro: 'Panel de solo lectura: qué se juega, qué se comparte y cuántas cuentas nacen.',
    moderationLink: 'Cola de moderación',
    reportsLink: 'Reportes',
    loadError: 'No pudimos cargar las estadísticas. Recarga la página para reintentar.',
    empty: 'Sin datos todavía.',
    truncatedNote:
      'Hay más filas que el máximo que esta vista recorre; las cifras de esta sección son parciales.',
    kpiPublished: 'Quizzes publicados',
    kpiSessions: 'Partidas totales',
    kpiProfiles: 'Cuentas',
    kpiComments: 'Comentarios',
    kpiPendingReports: 'Reportes pendientes',
    playTitle: 'Partidas por día',
    playIntro: (days: number) => `Últimos ${days} días, agrupados en UTC.`,
    playWindow: (total: number, registered: string, anonymous: string) =>
      `${total} partidas en la ventana: ${registered} con sesión · ${anonymous} anónimas`,
    playAllTime: (registered: string, anonymous: string) =>
      `Histórico: ${registered} con sesión · ${anonymous} anónimas`,
    colDate: 'Fecha',
    colTotal: 'Total',
    colRegistered: 'Con sesión',
    colAnonymous: 'Anónimas',
    topPlays: 'Más jugados',
    topShares: 'Más compartidos',
    topLikes: 'Más gustados',
    catalogTitle: 'Catálogo publicado',
    byLanguage: 'Por idioma',
    byType: 'Por tipo',
    byCategory: 'Por categoría',
    uncategorized: 'Sin categoría',
    colName: 'Nombre',
    colCount: 'Cantidad',
    colShare: '%',
    accountsTitle: 'Cuentas y comunidad',
    rowProfilesTotal: 'Cuentas totales',
    rowProfiles7d: 'Cuentas nuevas (7 días)',
    rowProfiles30d: 'Cuentas nuevas (30 días)',
    rowComments: 'Comentarios totales',
    rowPendingQuizReports: 'Reportes de quizzes pendientes',
    rowPendingCommentReports: 'Reportes de comentarios pendientes',
    unavailable: '—',
    type: {
      trivia: 'Trivia',
      personality: 'Personalidad',
      poll: 'Encuesta',
    } satisfies Record<QuizType, string>,
  },
  en: {
    eyebrow: 'Administration',
    title: 'Site statistics',
    intro: 'Read-only dashboard: what gets played, what gets shared and how accounts grow.',
    moderationLink: 'Moderation queue',
    reportsLink: 'Reports',
    loadError: 'We could not load the statistics. Reload the page to try again.',
    empty: 'No data yet.',
    truncatedNote: 'There are more rows than this view scans; figures in this section are partial.',
    kpiPublished: 'Published quizzes',
    kpiSessions: 'Total plays',
    kpiProfiles: 'Accounts',
    kpiComments: 'Comments',
    kpiPendingReports: 'Pending reports',
    playTitle: 'Plays per day',
    playIntro: (days: number) => `Last ${days} days, grouped in UTC.`,
    playWindow: (total: number, registered: string, anonymous: string) =>
      `${total} plays in the window: ${registered} signed-in · ${anonymous} anonymous`,
    playAllTime: (registered: string, anonymous: string) =>
      `All time: ${registered} signed-in · ${anonymous} anonymous`,
    colDate: 'Date',
    colTotal: 'Total',
    colRegistered: 'Signed-in',
    colAnonymous: 'Anonymous',
    topPlays: 'Most played',
    topShares: 'Most shared',
    topLikes: 'Most liked',
    catalogTitle: 'Published catalog',
    byLanguage: 'By language',
    byType: 'By type',
    byCategory: 'By category',
    uncategorized: 'Uncategorized',
    colName: 'Name',
    colCount: 'Count',
    colShare: '%',
    accountsTitle: 'Accounts & community',
    rowProfilesTotal: 'Total accounts',
    rowProfiles7d: 'New accounts (7 days)',
    rowProfiles30d: 'New accounts (30 days)',
    rowComments: 'Total comments',
    rowPendingQuizReports: 'Pending quiz reports',
    rowPendingCommentReports: 'Pending comment reports',
    unavailable: '—',
    type: {
      trivia: 'Trivia',
      personality: 'Personality',
      poll: 'Poll',
    } satisfies Record<QuizType, string>,
  },
} as const;

const TH = 'text-text-muted px-3 py-2 text-left text-xs font-medium';
const TD = 'text-text-secondary px-3 py-2 text-sm';
const TABLE = 'w-full table-fixed';

export default async function AdminStatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const { user, isAdmin } = await requireAdmin();
  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/admin/estadisticas'))}`
      )
    );
  }
  if (!isAdmin) notFound();

  // game_sessions solo la lee su jugador por RLS: el panel necesita service
  // role (servidor). Sin la clave configurada no hay panel, no medias cifras.
  const service = createServiceClient();
  let stats: AdminStats | null = null;
  if (service) {
    try {
      stats = await loadAdminStats(service);
    } catch (error) {
      console.error('[admin/estadisticas] fallo al cargar estadísticas:', error);
    }
  }

  const copy = COPY[locale as Locale] ?? COPY.en;
  const num = (n: number) => formatNumber(n, locale);
  const percent = (share: number) =>
    new Intl.NumberFormat(locale === 'es' ? 'es' : 'en-US', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(share);
  const signedInShare = (registered: number, total: number) =>
    `${percent(shareOf(registered, total))}`;

  const maxDaily = stats ? Math.max(1, ...stats.sessions.daily.map((day) => day.total)) : 1;

  const groupTable = (groups: GroupCount[], label: (key: string | null) => string) => (
    <table className={TABLE}>
      <thead>
        <tr className="border-border-subtle border-b">
          <th scope="col" className={TH}>
            {copy.colName}
          </th>
          <th scope="col" className={`${TH} w-20 text-right`}>
            {copy.colCount}
          </th>
          <th scope="col" className={`${TH} w-16 text-right`}>
            {copy.colShare}
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <tr key={group.key ?? 'none'} className="border-border-subtle border-b last:border-0">
            <td className={`${TD} truncate`}>{label(group.key)}</td>
            <td className={`${TD} text-right tabular-nums`}>{num(group.count)}</td>
            <td className={`${TD} text-text-muted text-right tabular-nums`}>
              {percent(group.share)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const topTable = (rows: TopQuiz[]) =>
    rows.length === 0 ? (
      <p className="text-text-secondary mt-3 text-sm">{copy.empty}</p>
    ) : (
      <ol className="mt-3 space-y-2">
        {rows.map((quiz, index) => {
          const quizLocale = hasLocale(quiz.language) ? quiz.language : locale;
          return (
            <li key={quiz.slug} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <Link
                  href={localizeHref(quizLocale, `/quiz/${quiz.slug}`)}
                  className="text-text-primary hover:text-accent-primary text-sm font-medium transition-colors"
                >
                  {index + 1}. {quiz.title}
                </Link>
                <span className="text-text-muted mt-0.5 block truncate text-xs">{quiz.slug}</span>
              </span>
              <span className="text-text-secondary shrink-0 text-sm tabular-nums">
                {num(quiz.value)}
              </span>
            </li>
          );
        })}
      </ol>
    );

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.title}
            </h1>
            <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">{copy.intro}</p>
          </div>
          <nav aria-label="Admin" className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
            <Link
              href={localizeHref(locale, '/admin/moderacion')}
              className="text-accent-primary hover:text-accent-hover inline-flex min-h-11 items-center transition-colors"
            >
              {copy.moderationLink}
            </Link>
            <Link
              href={localizeHref(locale, '/admin/reportes')}
              className="text-accent-primary hover:text-accent-hover inline-flex min-h-11 items-center transition-colors"
            >
              {copy.reportsLink}
            </Link>
          </nav>
        </div>
      </section>

      {!stats ? (
        <section className="surface-panel mt-6 p-8 md:p-10" role="alert">
          <p className="text-error">{copy.loadError}</p>
        </section>
      ) : (
        <>
          <section aria-label={copy.title} className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: copy.kpiPublished, value: num(stats.catalog.published) },
              { label: copy.kpiSessions, value: num(stats.sessions.allTimeTotal) },
              { label: copy.kpiProfiles, value: num(stats.accounts.profilesTotal) },
              { label: copy.kpiComments, value: num(stats.community.commentsTotal) },
              {
                label: copy.kpiPendingReports,
                value: num(
                  stats.community.pendingQuizReports + (stats.community.pendingCommentReports ?? 0)
                ),
              },
            ].map((kpi) => (
              <div key={kpi.label} className="surface-panel p-4">
                <p className="text-text-muted text-xs">{kpi.label}</p>
                <p className="text-text-primary mt-1 text-2xl font-semibold tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </section>

          <section className="surface-panel mt-6 p-8 md:p-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-text-primary text-xl font-semibold">{copy.playTitle}</h2>
                <p className="text-text-muted mt-1 text-sm">
                  {copy.playIntro(stats.sessions.windowDays)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-text-secondary text-sm">
                  {copy.playWindow(
                    stats.sessions.windowTotal,
                    `${num(stats.sessions.windowRegistered)} (${signedInShare(stats.sessions.windowRegistered, stats.sessions.windowTotal)})`,
                    num(stats.sessions.windowAnonymous)
                  )}
                </p>
                <p className="text-text-muted mt-1 text-xs">
                  {copy.playAllTime(
                    `${num(stats.sessions.allTimeRegistered)} (${signedInShare(stats.sessions.allTimeRegistered, stats.sessions.allTimeTotal)})`,
                    num(stats.sessions.allTimeAnonymous)
                  )}
                </p>
              </div>
            </div>
            {stats.sessions.truncated ? (
              <p className="text-warning mt-2 text-xs">{copy.truncatedNote}</p>
            ) : null}
            {stats.sessions.windowTotal === 0 ? (
              <p className="text-text-secondary mt-4 text-sm">{copy.empty}</p>
            ) : (
              <div aria-hidden="true" className="mt-6 flex h-28 items-end gap-0.5">
                {stats.sessions.daily.map((day) => (
                  <div
                    key={day.date}
                    className="bg-accent-primary/70 min-w-0 flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max((day.total / maxDaily) * 100, day.total > 0 ? 4 : 0)}%`,
                    }}
                    title={`${day.date}: ${day.total}`}
                  />
                ))}
              </div>
            )}
            <div className="mt-6 overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr className="border-border-subtle border-b">
                    <th scope="col" className={TH}>
                      {copy.colDate}
                    </th>
                    <th scope="col" className={`${TH} w-20 text-right`}>
                      {copy.colTotal}
                    </th>
                    <th scope="col" className={`${TH} w-24 text-right`}>
                      {copy.colRegistered}
                    </th>
                    <th scope="col" className={`${TH} w-24 text-right`}>
                      {copy.colAnonymous}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sessions.daily.map((day) => (
                    <tr key={day.date} className="border-border-subtle border-b last:border-0">
                      <td className={`${TD} text-text-muted`}>{day.date}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(day.total)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(day.registered)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(day.anonymous)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="surface-panel p-6">
              <h2 className="text-text-primary text-lg font-semibold">{copy.topPlays}</h2>
              {topTable(stats.top.byPlays)}
            </div>
            <div className="surface-panel p-6">
              <h2 className="text-text-primary text-lg font-semibold">{copy.topShares}</h2>
              {topTable(stats.top.byShares)}
            </div>
            <div className="surface-panel p-6">
              <h2 className="text-text-primary text-lg font-semibold">{copy.topLikes}</h2>
              {topTable(stats.top.byLikes)}
            </div>
          </section>

          <section className="surface-panel mt-6 p-8 md:p-10">
            <h2 className="text-text-primary text-xl font-semibold">{copy.catalogTitle}</h2>
            {stats.catalog.truncated ? (
              <p className="text-warning mt-2 text-xs">{copy.truncatedNote}</p>
            ) : null}
            {stats.catalog.published === 0 ? (
              <p className="text-text-secondary mt-4 text-sm">{copy.empty}</p>
            ) : (
              <div className="mt-4 grid gap-6 md:grid-cols-3">
                <div>
                  <h3 className="text-text-secondary text-sm font-medium">{copy.byLanguage}</h3>
                  <div className="mt-2">
                    {groupTable(stats.catalog.byLanguage, (key) => key ?? copy.uncategorized)}
                  </div>
                </div>
                <div>
                  <h3 className="text-text-secondary text-sm font-medium">{copy.byType}</h3>
                  <div className="mt-2">
                    {groupTable(
                      stats.catalog.byType,
                      (key) => copy.type[key as QuizType] ?? key ?? copy.uncategorized
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-text-secondary text-sm font-medium">{copy.byCategory}</h3>
                  <div className="mt-2">
                    {groupTable(stats.catalog.byCategory, (key) => key ?? copy.uncategorized)}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="surface-panel mt-6 p-8 md:p-10">
            <h2 className="text-text-primary text-xl font-semibold">{copy.accountsTitle}</h2>
            <table className={`${TABLE} mt-4`}>
              <tbody>
                {[
                  [copy.rowProfilesTotal, num(stats.accounts.profilesTotal)],
                  [copy.rowProfiles7d, num(stats.accounts.profilesNew7d)],
                  [copy.rowProfiles30d, num(stats.accounts.profilesNew30d)],
                  [copy.rowComments, num(stats.community.commentsTotal)],
                  [copy.rowPendingQuizReports, num(stats.community.pendingQuizReports)],
                  [
                    copy.rowPendingCommentReports,
                    stats.community.pendingCommentReports === null
                      ? copy.unavailable
                      : num(stats.community.pendingCommentReports),
                  ],
                ].map(([label, value]) => (
                  <tr key={label} className="border-border-subtle border-b last:border-0">
                    <td className={TD}>{label}</td>
                    <td className={`${TD} w-28 text-right tabular-nums`}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
