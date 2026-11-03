'use client';

/**
 * Sección de comentarios de la ficha del quiz.
 *
 * La ficha es estática: la lista se pide al montar con `getQuizComments` y el
 * alta va a `createComment` (server action). Si la lectura falla se muestra un
 * aviso con reintento, distinto del vacío real — la página nunca se rompe por
 * esta sección.
 *
 * Moderación (autorización real en el servidor, aquí solo se decide qué botón
 * pintar): el autor borra el suyo; el creador del quiz oculta/muestra; el
 * admin además borra ajenos; y cualquier usuario con sesión reporta desde un
 * modal con motivo.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createComment,
  deleteComment,
  getQuizComments,
  reportComment,
  setCommentHidden,
  type QuizComment,
  type QuizCommentsPage,
} from '@/actions/comments.actions';
import { useSupabase } from '@/providers/supabase-provider';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { ReportReason } from '@/types/database';

const REASONS: ReportReason[] = [
  'inappropriate',
  'spam',
  'incorrect_info',
  'hate_speech',
  'copyright',
  'other',
];

const COPY = {
  es: {
    title: 'Comentarios',
    empty: 'Sé la primera persona en comentar.',
    loading: 'Cargando comentarios…',
    loadError: 'No pudimos cargar los comentarios.',
    retry: 'Reintentar',
    placeholder: 'Escribe un comentario…',
    submit: 'Comentar',
    submitting: 'Publicando…',
    signIn: 'Inicia sesión para comentar',
    error: 'No pudimos publicar tu comentario. Inténtalo otra vez.',
    rateLimited: 'Estás comentando muy rápido. Espera un momento.',
    count: (n: number) => (n === 1 ? '1 comentario' : `${n} comentarios`),
    latestOnly: 'Se muestran los 50 más recientes.',
    hiddenBadge: 'Oculto',
    delete: 'Borrar',
    deleting: 'Borrando…',
    confirmDelete: '¿Borrar este comentario? No se puede deshacer.',
    hide: 'Ocultar',
    unhide: 'Mostrar',
    report: 'Reportar',
    reportTitle: 'Reportar comentario',
    reportDescription:
      'Ayúdanos a mantener QuizVerse útil y seguro. Cuéntanos qué problema tiene este comentario.',
    reportPlaceholder: 'Cuéntanos un poco más… (opcional)',
    cancel: 'Cancelar',
    close: 'Cerrar',
    reportSubmit: 'Enviar reporte',
    reportSubmitting: 'Enviando…',
    reportSuccess: 'Gracias. Revisaremos este comentario.',
    reportDuplicate: 'Ya reportaste este comentario.',
    reportError: 'No pudimos enviar el reporte. Inténtalo otra vez.',
    actionError: 'No pudimos completar la acción. Inténtalo otra vez.',
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
    title: 'Comments',
    empty: 'Be the first to comment.',
    loading: 'Loading comments…',
    loadError: 'We could not load the comments.',
    retry: 'Try again',
    placeholder: 'Write a comment…',
    submit: 'Comment',
    submitting: 'Posting…',
    signIn: 'Sign in to comment',
    error: 'We could not post your comment. Please try again.',
    rateLimited: 'You are commenting too fast. Please wait.',
    count: (n: number) => (n === 1 ? '1 comment' : `${n} comments`),
    latestOnly: 'Showing the 50 most recent.',
    hiddenBadge: 'Hidden',
    delete: 'Delete',
    deleting: 'Deleting…',
    confirmDelete: 'Delete this comment? This cannot be undone.',
    hide: 'Hide',
    unhide: 'Unhide',
    report: 'Report',
    reportTitle: 'Report comment',
    reportDescription:
      'Help us keep QuizVerse useful and safe. Tell us what felt wrong about this comment.',
    reportPlaceholder: 'Tell us a bit more… (optional)',
    cancel: 'Cancel',
    close: 'Close',
    reportSubmit: 'Submit report',
    reportSubmitting: 'Submitting…',
    reportSuccess: 'Thanks. We will review this comment.',
    reportDuplicate: 'You already reported this comment.',
    reportError: 'We could not submit the report. Please try again.',
    actionError: 'We could not complete the action. Please try again.',
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

function relativeDate(iso: string, locale: Locale): string {
  const then = new Date(iso);
  const diffSeconds = Math.round((then.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSeconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 604800) return rtf.format(Math.round(diffSeconds / 86400), 'day');
  return then.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function AuthorAvatar({ author }: { author: QuizComment['author'] }) {
  const initial = (author?.display_name ?? author?.username ?? '?').charAt(0).toUpperCase();
  if (author?.avatar_url) {
    return (
      // El avatar sale de `raw_user_meta_data` del proveedor OAuth, así que el
      // host es arbitrario: next/image lo rechazaría por no estar en
      // remotePatterns, y a 36 px no gana nada con el optimizador.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar_url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="bg-bg-tertiary text-accent-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
    >
      {initial}
    </span>
  );
}

export function QuizComments({ quizId, locale }: { quizId: string; locale: Locale }) {
  const copy = COPY[locale];
  const pathname = usePathname();
  const { user, loading: authLoading } = useSupabase();
  // `loaded` se etiqueta con su quizId: al navegar entre fichas el componente
  // se reutiliza y no puede mostrar comentarios del quiz anterior ni aceptar
  // un alta que resuelva ya en la ficha nueva. `status: 'error'` distingue un
  // fallo de carga del vacío real (sin él, una caída pintaba "0 comentarios").
  const [loaded, setLoaded] = useState<
    | { quizId: string; status: 'ok'; page: QuizCommentsPage }
    | { quizId: string; status: 'error' }
    | null
  >(null);
  const state = loaded?.quizId === quizId ? loaded : null;
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El reintento pasa por el efecto (subiendo `attempt`): así una respuesta
  // tardía queda descartada por `cancelled` si la ficha cambió de quiz.
  const [attempt, setAttempt] = useState(0);
  // Moderación: `busyId` serializa borrado/ocultado; `itemError` se pinta
  // bajo el comentario que falló. El reporte vive en un modal con su propio
  // estado; al cambiar de quiz se cierra para no reportar a ciegas.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<QuizComment | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | ''>('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportPending, setReportPending] = useState(false);
  const [reportStatus, setReportStatus] = useState<'idle' | 'success' | 'error' | 'duplicate'>(
    'idle'
  );

  // Al cambiar de ficha se descartan los restos de moderación durante el
  // propio render (patrón "adjust state during render", como quiz-player):
  // un modal abierto sobre un comentario del quiz anterior se cierra.
  const [prevQuizId, setPrevQuizId] = useState(quizId);
  if (prevQuizId !== quizId) {
    setPrevQuizId(quizId);
    setReportTarget(null);
    setItemError(null);
  }

  useEffect(() => {
    let cancelled = false;
    // Un aviso enlaza a #comment-<id>: se pide ese comentario además de los
    // últimos 50 para que el ancla exista aunque haya quedado fuera.
    const anchorId = window.location.hash.startsWith('#comment-')
      ? window.location.hash.slice('#comment-'.length)
      : undefined;
    getQuizComments(quizId, anchorId)
      .then((page) => {
        if (!cancelled) setLoaded({ quizId, status: 'ok', page });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ quizId, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [quizId, attempt]);

  // La lista se pide en cliente: una URL con #comment-<id> no encuentra el
  // ancla en el HTML inicial, así que el scroll espera a que cargue.
  useEffect(() => {
    if (loaded?.quizId !== quizId || loaded.status !== 'ok') return;
    const anchor = window.location.hash.slice(1);
    if (anchor.startsWith('comment-')) {
      document.getElementById(anchor)?.scrollIntoView({ block: 'center' });
    }
  }, [loaded, quizId]);

  function handleRetry() {
    setLoaded(null);
    setAttempt((value) => value + 1);
  }

  function patchComments(patch: {
    remove?: string;
    update?: { id: string; hidden_at: string | null };
  }) {
    setLoaded((prev) =>
      prev && prev.quizId === quizId && prev.status === 'ok'
        ? {
            ...prev,
            page: {
              ...prev.page,
              total: patch.remove ? Math.max(0, prev.page.total - 1) : prev.page.total,
              comments: patch.remove
                ? prev.page.comments.filter((comment) => comment.id !== patch.remove)
                : prev.page.comments.map((comment) =>
                    comment.id === patch.update?.id
                      ? { ...comment, hidden_at: patch.update.hidden_at }
                      : comment
                  ),
            },
          }
        : prev
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await createComment(quizId, body);
      if (result.success) {
        setLoaded((prev) =>
          prev && prev.quizId !== quizId
            ? prev
            : {
                quizId,
                status: 'ok',
                page: {
                  comments: [result.comment, ...(prev?.status === 'ok' ? prev.page.comments : [])],
                  total: (prev?.status === 'ok' ? prev.page.total : 0) + 1,
                  viewerCanModerate: prev?.status === 'ok' ? prev.page.viewerCanModerate : false,
                  viewerIsAdmin: prev?.status === 'ok' ? prev.page.viewerIsAdmin : false,
                },
              }
        );
        setDraft('');
      } else {
        setError(result.code === 'rate_limited' ? copy.rateLimited : copy.error);
      }
    } catch {
      setError(copy.error);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(comment: QuizComment) {
    if (busyId || !window.confirm(copy.confirmDelete)) return;
    setBusyId(comment.id);
    setItemError(null);
    try {
      const result = await deleteComment(comment.id);
      if (result.success) {
        patchComments({ remove: comment.id });
      } else {
        setItemError(comment.id);
      }
    } catch {
      setItemError(comment.id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleHidden(comment: QuizComment) {
    if (busyId) return;
    setBusyId(comment.id);
    setItemError(null);
    try {
      const result = await setCommentHidden(comment.id, !comment.hidden_at);
      if (result.success) {
        patchComments({ update: { id: comment.id, hidden_at: result.hiddenAt } });
      } else {
        setItemError(comment.id);
      }
    } catch {
      setItemError(comment.id);
    } finally {
      setBusyId(null);
    }
  }

  function openReport(comment: QuizComment) {
    setReportTarget(comment);
    setReportReason('');
    setReportDetails('');
    setReportStatus('idle');
  }

  function closeReport() {
    setReportTarget(null);
  }

  async function handleReportSubmit() {
    if (!reportTarget || !reportReason || reportPending) return;
    setReportPending(true);
    setReportStatus('idle');
    try {
      const result = await reportComment(reportTarget.id, reportReason, reportDetails);
      if (result.success) {
        setReportStatus('success');
        setTimeout(closeReport, 900);
      } else {
        setReportStatus(result.code === 'conflict' ? 'duplicate' : 'error');
      }
    } catch {
      setReportStatus('error');
    } finally {
      setReportPending(false);
    }
  }

  const loginHref = localizeHref(locale, `/login?redirect=${encodeURIComponent(pathname || '/')}`);

  return (
    <section className="arcade-related" aria-labelledby="quiz-comments">
      <div className="arcade-section-head">
        <h2 id="quiz-comments">{copy.title}</h2>
        <p aria-live="polite">
          {state === null
            ? copy.loading
            : state.status === 'error'
              ? copy.loadError
              : `${copy.count(state.page.total)}${state.page.total > state.page.comments.length ? ` · ${copy.latestOnly}` : ''}`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
          maxLength={1000}
          rows={3}
          className="border-border-subtle bg-bg-tertiary text-text-primary placeholder:text-text-muted w-full resize-none rounded-[4px] border p-3"
        />
        {error ? (
          <p role="alert" className="text-error mt-2 text-sm">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          {user || authLoading ? (
            <button
              type="submit"
              disabled={pending || authLoading || !draft.trim()}
              className="arcade-button arcade-button-lime disabled:opacity-60"
            >
              {pending ? copy.submitting : copy.submit}
            </button>
          ) : (
            <Link href={loginHref} className="arcade-button arcade-button-lime">
              {copy.signIn}
            </Link>
          )}
        </div>
      </form>

      {state === null ? null : state.status === 'error' ? (
        <div className="border-border-subtle bg-bg-secondary flex flex-col gap-4 rounded-[4px] border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-text-secondary text-sm">
            {copy.loadError}
          </p>
          <button type="button" onClick={handleRetry} className="arcade-button arcade-button-lime">
            {copy.retry}
          </button>
        </div>
      ) : state.page.comments.length === 0 ? (
        <p className="text-text-muted text-sm">{copy.empty}</p>
      ) : (
        <ul className="space-y-3">
          {state.page.comments.map((comment) => {
            const mine = user?.id === comment.user_id;
            const hidden = comment.hidden_at !== null;
            const canModerate = state.page.viewerCanModerate && !mine;
            const canDelete = mine || (state.page.viewerIsAdmin && !mine);
            const canReport = Boolean(user) && !mine;
            return (
              <li
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`border-border-subtle bg-bg-secondary flex gap-3 rounded-[4px] border p-4${hidden ? 'opacity-60' : ''}`}
              >
                <AuthorAvatar author={comment.author} />
                <div className="min-w-0">
                  <p className="text-text-secondary flex flex-wrap items-baseline gap-x-2 text-xs">
                    {comment.author ? (
                      <Link
                        href={localizeHref(
                          locale,
                          `/profile/${encodeURIComponent(comment.author.username)}`
                        )}
                        className="text-text-primary font-semibold underline-offset-2 hover:underline"
                      >
                        @{comment.author.username}
                      </Link>
                    ) : (
                      <span className="text-text-primary font-semibold">@…</span>
                    )}
                    {comment.author?.display_name ? (
                      <span>{comment.author.display_name}</span>
                    ) : null}
                    <time dateTime={comment.created_at} className="text-text-muted">
                      {relativeDate(comment.created_at, locale)}
                    </time>
                    {hidden ? (
                      <span className="border-border-subtle text-text-muted rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                        {copy.hiddenBadge}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-text-primary mt-1 text-sm leading-6 whitespace-pre-wrap">
                    {comment.body}
                  </p>
                  {canDelete || canModerate || (user && canReport) ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(comment)}
                          disabled={busyId === comment.id}
                          className="text-text-muted hover:text-error transition-colors disabled:opacity-60"
                        >
                          {busyId === comment.id ? copy.deleting : copy.delete}
                        </button>
                      ) : null}
                      {canModerate ? (
                        <button
                          type="button"
                          onClick={() => handleToggleHidden(comment)}
                          disabled={busyId === comment.id}
                          className="text-text-muted hover:text-accent-primary transition-colors disabled:opacity-60"
                        >
                          {hidden ? copy.unhide : copy.hide}
                        </button>
                      ) : null}
                      {user && canReport ? (
                        <button
                          type="button"
                          onClick={() => openReport(comment)}
                          className="text-text-muted hover:text-accent-primary transition-colors"
                        >
                          {copy.report}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {itemError === comment.id ? (
                    <p role="alert" className="text-error mt-2 text-xs font-medium">
                      {copy.actionError}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={reportTarget !== null}
        onClose={closeReport}
        title={copy.reportTitle}
        closeLabel={copy.close}
      >
        <div className="space-y-4">
          <p className="text-text-secondary text-sm leading-6">{copy.reportDescription}</p>

          {reportTarget ? (
            <blockquote className="border-border-subtle text-text-secondary line-clamp-3 border-l-2 pl-3 text-sm">
              {reportTarget.body}
            </blockquote>
          ) : null}

          <div className="space-y-2">
            {REASONS.map((reason) => (
              <label
                key={reason}
                className="border-border-subtle hover:bg-bg-tertiary flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors"
              >
                <input
                  type="radio"
                  name="comment-report-reason"
                  value={reason}
                  checked={reportReason === reason}
                  onChange={() => setReportReason(reason)}
                  className="text-accent-primary h-4 w-4"
                />
                <span className="text-text-primary">{copy.reasons[reason]}</span>
              </label>
            ))}
          </div>

          <textarea
            value={reportDetails}
            onChange={(event) => setReportDetails(event.target.value)}
            placeholder={copy.reportPlaceholder}
            aria-label={copy.reportPlaceholder}
            maxLength={1000}
            rows={3}
            className="border-border-subtle bg-bg-tertiary text-text-primary placeholder:text-text-muted w-full resize-none rounded-2xl border p-3"
          />

          {reportStatus === 'success' ? (
            <p
              id="comment-report-feedback"
              role="status"
              aria-live="polite"
              className="text-success text-sm font-medium"
            >
              {copy.reportSuccess}
            </p>
          ) : null}
          {reportStatus === 'duplicate' ? (
            <p
              id="comment-report-feedback"
              role="status"
              aria-live="polite"
              className="text-text-secondary text-sm font-medium"
            >
              {copy.reportDuplicate}
            </p>
          ) : null}
          {reportStatus === 'error' ? (
            <p id="comment-report-feedback" role="alert" className="text-error text-sm font-medium">
              {copy.reportError}
            </p>
          ) : null}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={closeReport} className="flex-1">
              {copy.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={handleReportSubmit}
              disabled={!reportReason || reportPending}
              aria-describedby={reportStatus !== 'idle' ? 'comment-report-feedback' : undefined}
              className="flex-1"
            >
              {reportPending ? copy.reportSubmitting : copy.reportSubmit}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

export default QuizComments;
