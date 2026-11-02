import type { QuizStatus } from '@/types/database';

/** Etiqueta y tono del chip de estado en las pantallas del estudio. */
export const STATUS_LABEL: Record<QuizStatus, { es: string; en: string }> = {
  draft: { es: 'Borrador', en: 'Draft' },
  pending: { es: 'En revisión', en: 'In review' },
  published: { es: 'Publicado', en: 'Published' },
  rejected: { es: 'Rechazado', en: 'Rejected' },
  archived: { es: 'Archivado', en: 'Archived' },
};

export const STATUS_TONE: Record<QuizStatus, string> = {
  draft: 'border-border-subtle text-text-secondary',
  pending: 'border-warning/50 text-warning',
  published: 'border-success/50 text-success',
  rejected: 'border-error/50 text-error',
  archived: 'border-border-subtle text-text-muted',
};
