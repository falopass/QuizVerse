'use client';

/**
 * Cola de reportes abiertos para el admin.
 *
 * El servidor entrega los últimos 100 sin resolver y «marcar revisado» va a
 * `resolveQuizReport`; la lista se relee con `router.refresh()` como en
 * notifications. El enlace al quiz usa el idioma propio del quiz reportado,
 * que no siempre es el del navegador del admin.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveQuizReport } from '@/actions/moderation.actions';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatRelativeDate } from '@/lib/utils/format';
import type { QuizStatus, ReportReason } from '@/types/database';

export interface AdminReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  reporter_id: string | null;
  created_at: string;
  /** Snapshot que la DB guarda al crear el reporte (migración 016). */
  quiz_title: string | null;
  quiz_slug: string | null;
  quiz: {
    id: string;
    slug: string;
    title: string;
    status: QuizStatus;
    language: string;
  } | null;
}

const COPY = {
  es: {
    empty: 'No hay reportes pendientes. Buen trabajo.',
    anonymous: 'Anónimo',
    registered: 'Registrado',
    reportedBy: 'Reportado por',
    publicQuiz: 'Ver pública',
    deletedQuiz: 'Quiz eliminado o no visible',
    resolve: 'Marcar revisado',
    resolving: 'Marcando…',
    error: 'No pudimos marcarlo. Inténtalo otra vez.',
    reasons: {
      inappropriate: 'Contenido inapropiado',
      spam: 'Spam o engañoso',
      incorrect_info: 'Información incorrecta',
      hate_speech: 'Discurso de odio',
      copyright: 'Problema de copyright',
      other: 'Otro motivo',
    },
  },
  en: {
    empty: 'No pending reports. Nice work.',
    anonymous: 'Anonymous',
    registered: 'Signed in',
    reportedBy: 'Reported by',
    publicQuiz: 'View public page',
    deletedQuiz: 'Quiz deleted or not visible',
    resolve: 'Mark reviewed',
    resolving: 'Marking…',
    error: 'We could not mark it. Please try again.',
    reasons: {
      inappropriate: 'Inappropriate content',
      spam: 'Spam or misleading',
      incorrect_info: 'Incorrect information',
      hate_speech: 'Hate speech',
      copyright: 'Copyright issue',
      other: 'Other',
    },
  },
} as const;

function reportPublicHref(quiz: NonNullable<AdminReport['quiz']>): string {
  const quizLocale = quiz.language === 'es' ? 'es' : 'en';
  return localizeHref(quizLocale, `/quiz/${quiz.slug}`);
}

export function ReportList({ reports, locale }: { reports: AdminReport[]; locale: Locale }) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleResolve(reportId: string) {
    if (pendingId) return;
    setPendingId(reportId);
    setErrorId(null);
    try {
      const result = await resolveQuizReport(reportId);
      if (result.success) {
        router.refresh();
      } else {
        setErrorId(reportId);
      }
    } catch {
      setErrorId(reportId);
    } finally {
      setPendingId(null);
    }
  }

  if (reports.length === 0) {
    return (
      <section className="surface-panel mt-6 p-8 md:p-10">
        <p className="text-text-secondary">{copy.empty}</p>
      </section>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {reports.map((report) => (
        <li key={report.id} className="surface-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-text-primary font-medium">
                {copy.reasons[report.reason] ?? report.reason}
              </p>
              {report.quiz ? (
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href={localizeHref(locale, `/admin/quizzes/${report.quiz.id}`)}
                    className="text-accent-primary hover:text-accent-hover text-sm font-medium transition-colors"
                  >
                    {report.quiz.title}
                  </Link>
                  {report.quiz.status === 'published' ? (
                    <Link
                      href={reportPublicHref(report.quiz)}
                      className="text-text-muted hover:text-text-primary text-xs transition-colors"
                    >
                      {copy.publicQuiz} →
                    </Link>
                  ) : null}
                </span>
              ) : (
                <p className="text-text-muted mt-1 text-sm">
                  {report.quiz_title ? `«${report.quiz_title}» · ` : ''}
                  {copy.deletedQuiz}
                </p>
              )}
              {report.details ? (
                <p className="text-text-secondary mt-2 text-sm leading-6">{report.details}</p>
              ) : null}
              <p className="text-text-muted mt-2 text-xs">
                {formatRelativeDate(report.created_at, locale)} · {copy.reportedBy}{' '}
                {report.reporter_id ? copy.registered : copy.anonymous}
                {report.quiz && report.quiz.status !== 'published'
                  ? ` · ${report.quiz.status}`
                  : ''}
              </p>
              {errorId === report.id ? (
                <p role="alert" className="text-error mt-2 text-sm font-medium">
                  {copy.error}
                </p>
              ) : null}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleResolve(report.id)}
              disabled={pendingId === report.id}
            >
              {pendingId === report.id ? copy.resolving : copy.resolve}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
