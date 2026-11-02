'use client';

/**
 * Botones de veredicto de la ficha de revisión.
 *
 * Recibe solo quizId/status/locale: la clave de respuestas se queda en el
 * server component padre y nunca cruza a cliente. Publicar y rechazar van a
 * `publishQuiz`/`rejectQuiz`, que revalidan y resuelven los reportes
 * abiertos; la lista se relee con `router.refresh()`.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publishQuiz, rejectQuiz } from '@/actions/moderation.actions';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { QuizStatus } from '@/types/database';

const COPY = {
  es: {
    publish: 'Publicar',
    publishing: 'Publicando…',
    publishConfirm: '¿Publicar este quiz? Pasará a ser público y el creador recibirá un aviso.',
    rejectTitle: 'Rechazar con motivo',
    reasonLabel: 'Motivo del rechazo (lo verá el creador)',
    reasonPlaceholder: 'Ej.: preguntas con errores factuales en 3 y 7.',
    reject: 'Rechazar quiz',
    rejecting: 'Rechazando…',
    published: 'Publicado.',
    rejected: 'Rechazado.',
    reasonTooShort: 'Escribe un motivo de al menos 3 caracteres.',
    genericError: 'No pudimos aplicar el veredicto. Inténtalo otra vez.',
    conflictError:
      'El quiz ya cambió de estado o falta la migración 016 en la base. Recarga la página.',
    done: 'Veredicto aplicado. El creador recibirá una notificación.',
  },
  en: {
    publish: 'Publish',
    publishing: 'Publishing…',
    publishConfirm: 'Publish this quiz? It becomes public and the creator is notified.',
    rejectTitle: 'Reject with reason',
    reasonLabel: 'Rejection reason (the creator will see it)',
    reasonPlaceholder: 'E.g.: factual errors in questions 3 and 7.',
    reject: 'Reject quiz',
    rejecting: 'Rejecting…',
    published: 'Published.',
    rejected: 'Rejected.',
    reasonTooShort: 'Write a reason of at least 3 characters.',
    genericError: 'We could not apply the verdict. Please try again.',
    conflictError: 'The quiz already changed state or migration 016 is missing. Reload the page.',
    done: 'Verdict applied. The creator will be notified.',
  },
} as const;

export function ModerationActions({
  quizId,
  status,
  locale,
  reportIds,
}: {
  quizId: string;
  status: QuizStatus;
  locale: Locale;
  /** Reportes abiertos que la ficha mostró: solo esos se cierran con el veredicto. */
  reportIds: string[];
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'publish' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Mismo criterio que el servidor: publicar solo desde pending/rejected;
  // rechazar también sobre published (takedown) y archived (cierra reportes).
  const canPublish = status === 'pending' || status === 'rejected';
  const canReject = status === 'pending' || status === 'published' || status === 'archived';
  if (!canPublish && !canReject) return null;

  async function handlePublish() {
    if (busy || !window.confirm(copy.publishConfirm)) return;
    setBusy('publish');
    setError(null);
    setDone(null);
    try {
      const result = await publishQuiz(quizId, reportIds);
      if (result.success) {
        setDone(copy.published);
        router.refresh();
      } else {
        setError(result.code === 'conflict' ? copy.conflictError : copy.genericError);
      }
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (busy) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError(copy.reasonTooShort);
      return;
    }
    setBusy('reject');
    setError(null);
    setDone(null);
    try {
      const result = await rejectQuiz(quizId, trimmed, reportIds);
      if (result.success) {
        setDone(copy.rejected);
        router.refresh();
      } else {
        setError(result.code === 'conflict' ? copy.conflictError : copy.genericError);
      }
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface-panel mt-6 p-8 md:p-10" aria-live="polite">
      <div className="flex flex-wrap items-start gap-6">
        {canPublish ? (
          <div>
            <Button onClick={handlePublish} disabled={busy !== null} isLoading={busy === 'publish'}>
              {busy === 'publish' ? copy.publishing : copy.publish}
            </Button>
          </div>
        ) : null}
        {canReject ? (
          <div className="min-w-0 flex-1">
            <h2 className="text-text-primary text-lg font-semibold">{copy.rejectTitle}</h2>
            <label
              htmlFor="moderation-reason"
              className="text-text-secondary mt-2 block text-sm font-medium"
            >
              {copy.reasonLabel}
            </label>
            <textarea
              id="moderation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.reasonPlaceholder}
              maxLength={500}
              rows={3}
              className="border-border-subtle bg-bg-secondary text-text-primary placeholder:text-text-muted focus:border-accent-primary mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={busy !== null}
              isLoading={busy === 'reject'}
              className="mt-3"
            >
              {busy === 'reject' ? copy.rejecting : copy.reject}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-error mt-4 text-sm font-medium">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-success mt-4 text-sm font-medium">
          {done} {copy.done}
        </p>
      ) : null}
    </section>
  );
}
