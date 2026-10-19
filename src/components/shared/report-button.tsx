'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/dictionaries';

export interface ReportButtonProps {
  quizId: string;
  quizSlug: string;
  locale?: Locale;
  className?: string;
}

export function ReportButton({ quizId, quizSlug, locale = 'en', className }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const copy =
    locale === 'es'
      ? {
          trigger: 'Reportar quiz',
          title: 'Reportar quiz',
          description:
            'Ayúdanos a mantener QuizVerse útil y seguro. Cuéntanos qué problema viste en este quiz.',
          placeholder: 'Cuéntanos un poco más…',
          cancel: 'Cancelar',
          submit: 'Enviar reporte',
          submitting: 'Enviando…',
          success: 'Gracias. Revisaremos este quiz pronto.',
          error: 'No pudimos enviar el reporte. Inténtalo otra vez.',
          reasons: [
            { value: 'inappropriate', label: 'Contenido inapropiado' },
            { value: 'spam', label: 'Spam o engañoso' },
            { value: 'incorrect_info', label: 'Información incorrecta' },
            { value: 'hate_speech', label: 'Discurso de odio' },
            { value: 'copyright', label: 'Problema de copyright' },
            { value: 'other', label: 'Otro motivo' },
          ],
        }
      : {
          trigger: 'Report quiz',
          title: 'Report quiz',
          description:
            'Help us keep QuizVerse useful and safe. Tell us what felt wrong about this quiz.',
          placeholder: 'Tell us a bit more…',
          cancel: 'Cancel',
          submit: 'Submit report',
          submitting: 'Submitting…',
          success: 'Thanks. We will review this quiz shortly.',
          error: 'We could not submit the report. Please try again.',
          reasons: [
            { value: 'inappropriate', label: 'Inappropriate content' },
            { value: 'spam', label: 'Spam or misleading' },
            { value: 'incorrect_info', label: 'Incorrect information' },
            { value: 'hate_speech', label: 'Hate speech' },
            { value: 'copyright', label: 'Copyright issue' },
            { value: 'other', label: 'Other' },
          ],
        };

  const reasons = useMemo(() => copy.reasons, [copy.reasons]);

  const reset = () => {
    setSelectedReason('');
    setDetails('');
    setStatus('idle');
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    setStatus('idle');

    try {
      const response = await fetch('/api/quiz/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: quizId,
          quiz_slug: quizSlug,
          reason: selectedReason,
          details,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      setStatus('success');
      setTimeout(() => {
        setIsOpen(false);
        reset();
      }, 900);
    } catch (error) {
      console.error('Failed to submit report:', error);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={[
          'text-text-muted hover:text-accent-primary text-sm transition-colors',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {copy.trigger}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          reset();
        }}
        title={copy.title}
        closeLabel={locale === 'es' ? 'Cerrar' : 'Close'}
      >
        <div className="space-y-4">
          <p className="text-text-secondary text-sm leading-6">{copy.description}</p>

          <div className="space-y-2">
            {reasons.map((reason) => (
              <label
                key={reason.value}
                className="border-border-subtle hover:bg-bg-tertiary flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors"
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason.value}
                  checked={selectedReason === reason.value}
                  onChange={(event) => setSelectedReason(event.target.value)}
                  className="text-accent-primary h-4 w-4"
                />
                <span className="text-text-primary">{reason.label}</span>
              </label>
            ))}
          </div>

          {(selectedReason === 'other' || status === 'error') && (
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={copy.placeholder}
              className="border-border-subtle bg-bg-tertiary text-text-primary placeholder:text-text-muted w-full resize-none rounded-2xl border p-3"
              rows={4}
            />
          )}

          {status === 'success' ? (
            <p className="text-success text-sm font-medium">{copy.success}</p>
          ) : null}
          {status === 'error' ? (
            <p className="text-error text-sm font-medium">{copy.error}</p>
          ) : null}

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
              className="flex-1"
            >
              {copy.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? copy.submitting : copy.submit}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default ReportButton;
