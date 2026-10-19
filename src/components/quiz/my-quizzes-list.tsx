'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteQuiz } from '@/actions/quiz.actions';
import { Button } from '@/components/ui/button';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import type { ActionErrorCode } from '@/lib/actions/types';
import type { QuizStatus, QuizType } from '@/types/database';

export interface MyQuizRow {
  id: string;
  slug: string;
  title: string;
  status: QuizStatus;
  quiz_type: QuizType;
  language: string;
  plays_count: number;
  likes_count: number;
  created_at: string;
}

const STATUS_LABEL: Record<QuizStatus, { es: string; en: string }> = {
  draft: { es: 'Borrador', en: 'Draft' },
  pending: { es: 'En revisión', en: 'In review' },
  published: { es: 'Publicado', en: 'Published' },
  rejected: { es: 'Rechazado', en: 'Rejected' },
  archived: { es: 'Archivado', en: 'Archived' },
};

const STATUS_TONE: Record<QuizStatus, string> = {
  draft: 'border-border-subtle text-text-secondary',
  pending: 'border-warning/50 text-warning',
  published: 'border-success/50 text-success',
  rejected: 'border-error/50 text-error',
  archived: 'border-border-subtle text-text-muted',
};

/** Server actions reply in English; map the code to the page locale. */
const ERROR_LABEL: Partial<Record<ActionErrorCode, { es: string; en: string }>> = {
  unauthorized: {
    es: 'Inicia sesión de nuevo para borrar.',
    en: 'Sign in again to delete.',
  },
  forbidden: {
    es: 'Ese quiz no es tuyo.',
    en: 'That quiz is not yours.',
  },
  not_found: {
    es: 'No encontramos ese quiz.',
    en: 'We could not find that quiz.',
  },
  rate_limited: {
    es: 'Demasiados intentos. Espera un momento.',
    en: 'Too many attempts. Please wait a moment.',
  },
};

export function MyQuizzesList({ quizzes, locale }: { quizzes: MyQuizRow[]; locale: Locale }) {
  const router = useRouter();
  const es = locale === 'es';
  const copy = es
    ? {
        trivia: 'Trivia',
        personality: 'Personalidad',
        plays: 'partidas',
        likes: 'me gusta',
        edit: 'Editar',
        delete: 'Borrar',
        confirm: (title: string) =>
          `¿Borrar «${title}»? Se eliminará para siempre, junto con sus partidas.`,
        genericError: 'No pudimos borrar el quiz ahora mismo.',
        emptyTitle: 'Todavía no has creado ningún quiz.',
        emptyBody: 'Tu primer quiz puede estar en revisión en cuestión de minutos.',
        emptyCta: 'Crear un quiz',
      }
    : {
        trivia: 'Trivia',
        personality: 'Personality',
        plays: 'plays',
        likes: 'likes',
        edit: 'Edit',
        delete: 'Delete',
        confirm: (title: string) =>
          `Delete "${title}"? It will be gone forever, along with its play sessions.`,
        genericError: 'We could not delete the quiz right now.',
        emptyTitle: 'You have not created any quizzes yet.',
        emptyBody: 'Your first quiz could be in review within minutes.',
        emptyCta: 'Create a quiz',
      };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const remove = async (quiz: MyQuizRow) => {
    if (!window.confirm(copy.confirm(quiz.title))) return;
    setDeletingId(quiz.id);
    setErrorMessage(null);
    try {
      const result = await deleteQuiz(quiz.id);
      if (!result.success) {
        setErrorMessage(ERROR_LABEL[result.code]?.[es ? 'es' : 'en'] ?? copy.genericError);
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage(copy.genericError);
    } finally {
      setDeletingId(null);
    }
  };

  if (quizzes.length === 0) {
    return (
      <section className="surface-card mt-8 p-10 text-center">
        <h2 className="text-text-primary text-2xl font-semibold">{copy.emptyTitle}</h2>
        <p className="text-text-secondary mt-2">{copy.emptyBody}</p>
        <Link
          href={localizeHref(locale, '/create')}
          className="bg-accent-primary hover:bg-accent-hover mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium text-white transition-colors"
        >
          {copy.emptyCta}
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8">
      {errorMessage ? (
        <p
          role="alert"
          className="border-error/40 bg-error/10 text-error mb-4 rounded-xl border px-4 py-3 text-sm"
        >
          {errorMessage}
        </p>
      ) : null}
      <ul className="space-y-4">
        {quizzes.map((quiz) => {
          const title =
            quiz.status === 'published' ? (
              <Link
                href={localizeHref(
                  hasLocale(quiz.language) ? quiz.language : locale,
                  `/quiz/${quiz.slug}`
                )}
                className="text-text-primary hover:text-accent-primary font-semibold transition-colors"
              >
                {quiz.title}
              </Link>
            ) : (
              <span className="text-text-primary font-semibold">{quiz.title}</span>
            );
          const date = new Date(quiz.created_at).toLocaleDateString(es ? 'es-ES' : 'en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          return (
            <li
              key={quiz.id}
              className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  {title}
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[quiz.status]}`}
                  >
                    {STATUS_LABEL[quiz.status][es ? 'es' : 'en']}
                  </span>
                </div>
                <p className="text-text-muted mt-2 text-sm">
                  {quiz.quiz_type === 'trivia' ? copy.trivia : copy.personality}
                  {' · '}
                  {formatCompactNumber(quiz.plays_count)} {copy.plays}
                  {' · '}
                  {formatCompactNumber(quiz.likes_count)} {copy.likes}
                  {' · '}
                  {date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={localizeHref(locale, `/my-quizzes/${quiz.id}/edit`)}
                  className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-all duration-200"
                >
                  {copy.edit}
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={deletingId === quiz.id}
                  disabled={deletingId !== null}
                  onClick={() => remove(quiz)}
                >
                  {copy.delete}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
