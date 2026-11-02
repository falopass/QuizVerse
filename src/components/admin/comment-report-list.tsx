'use client';

/**
 * Cola de reportes de comentarios para el admin.
 *
 * Cada reporte trae una copia del cuerpo reportado (`comment_body`), así que
 * sigue siendo legible aunque el comentario se haya borrado. El admin puede
 * marcarlo revisado o borrar el comentario de raíz (autorización real en las
 * server actions; aquí solo se decide qué botón pintar).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteComment, resolveCommentReport } from '@/actions/comments.actions';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatRelativeDate } from '@/lib/utils/format';
import type { QuizStatus, ReportReason } from '@/types/database';

export interface AdminCommentReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  reporter_id: string | null;
  created_at: string;
  comment_id: string | null;
  comment_body: string;
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
    heading: 'Comentarios reportados',
    empty: 'No hay reportes de comentarios pendientes.',
    anonymous: 'Anónimo',
    registered: 'Registrado',
    reportedBy: 'Reportado por',
    viewQuiz: 'Ver quiz',
    deletedQuiz: 'Quiz eliminado o no visible',
    deletedComment: 'Comentario ya eliminado',
    resolve: 'Marcar revisado',
    resolving: 'Marcando…',
    delete: 'Borrar comentario',
    deleting: 'Borrando…',
    confirmDelete: '¿Borrar este comentario? Desaparece para todos y no se puede deshacer.',
    error: 'No pudimos completar la acción. Inténtalo otra vez.',
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
    heading: 'Reported comments',
    empty: 'No pending comment reports.',
    anonymous: 'Anonymous',
    registered: 'Signed in',
    reportedBy: 'Reported by',
    viewQuiz: 'View quiz',
    deletedQuiz: 'Quiz deleted or not visible',
    deletedComment: 'Comment already deleted',
    resolve: 'Mark reviewed',
    resolving: 'Marking…',
    delete: 'Delete comment',
    deleting: 'Deleting…',
    confirmDelete: 'Delete this comment? It disappears for everyone and cannot be undone.',
    error: 'We could not complete the action. Please try again.',
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

function reportQuizHref(quiz: NonNullable<AdminCommentReport['quiz']>): string {
  const quizLocale = quiz.language === 'es' ? 'es' : 'en';
  return localizeHref(quizLocale, `/quiz/${quiz.slug}`);
}

export function CommentReportList({
  reports,
  locale,
}: {
  reports: AdminCommentReport[];
  locale: Locale;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function run(reportId: string, action: () => Promise<{ success: boolean }>) {
    if (pendingId) return;
    setPendingId(reportId);
    setErrorId(null);
    try {
      const result = await action();
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

  return (
    <section aria-labelledby="comment-reports" className="mt-10">
      <h2 id="comment-reports" className="text-text-primary text-2xl font-semibold tracking-tight">
        {copy.heading}
      </h2>
      {reports.length === 0 ? (
        <div className="surface-panel mt-4 p-8">
          <p className="text-text-secondary">{copy.empty}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="surface-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-text-primary font-medium">
                    {copy.reasons[report.reason] ?? report.reason}
                  </p>
                  <blockquote className="border-border-subtle text-text-secondary mt-2 border-l-2 pl-3 text-sm leading-6">
                    {report.comment_body}
                  </blockquote>
                  {report.quiz ? (
                    <Link
                      href={reportQuizHref(report.quiz)}
                      className="text-accent-primary hover:text-accent-hover mt-2 inline-block text-sm transition-colors"
                    >
                      {report.quiz.title}
                    </Link>
                  ) : (
                    <p className="text-text-muted mt-2 text-sm">{copy.deletedQuiz}</p>
                  )}
                  {report.details ? (
                    <p className="text-text-secondary mt-2 text-sm leading-6">{report.details}</p>
                  ) : null}
                  <p className="text-text-muted mt-2 text-xs">
                    {formatRelativeDate(report.created_at, locale)} · {copy.reportedBy}{' '}
                    {report.reporter_id ? copy.registered : copy.anonymous}
                    {report.comment_id === null ? ` · ${copy.deletedComment}` : ''}
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
                <div className="flex flex-wrap gap-2">
                  {report.comment_id ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(copy.confirmDelete)) return;
                        run(report.id, () => deleteComment(report.comment_id ?? ''));
                      }}
                      disabled={pendingId === report.id}
                    >
                      {pendingId === report.id ? copy.deleting : copy.delete}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => run(report.id, () => resolveCommentReport(report.id))}
                    disabled={pendingId === report.id}
                  >
                    {pendingId === report.id ? copy.resolving : copy.resolve}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default CommentReportList;
