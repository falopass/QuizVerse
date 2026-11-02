'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteQuiz, setQuizStatus } from '@/actions/quiz.actions';
import { Button } from '@/components/ui/button';
import { localizeHref } from '@/lib/i18n/navigation';
import { formatCompactNumber } from '@/lib/utils/format';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/quiz/quiz-status';
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

/** Server actions reply in English; map the code to the page locale. */
const ERROR_LABEL: Partial<Record<ActionErrorCode, { es: string; en: string }>> = {
  unauthorized: {
    es: 'Inicia sesión de nuevo para continuar.',
    en: 'Sign in again to continue.',
  },
  forbidden: {
    es: 'Ese quiz no es tuyo.',
    en: 'That quiz is not yours.',
  },
  not_found: {
    es: 'No encontramos ese quiz.',
    en: 'We could not find that quiz.',
  },
  conflict: {
    es: 'Ese quiz no está en un estado que permita ese cambio.',
    en: 'That quiz is not in a state that allows that change.',
  },
  rate_limited: {
    es: 'Demasiados intentos. Espera un momento.',
    en: 'Too many attempts. Please wait a moment.',
  },
};

/** Botón de transición que ofrece cada estado, si lo hay. */
function statusMove(
  status: QuizStatus
): { target: 'draft' | 'pending' | 'archived'; label: { es: string; en: string } } | null {
  if (status === 'draft')
    return { target: 'pending', label: { es: 'Enviar a revisión', en: 'Send to review' } };
  if (status === 'pending')
    return { target: 'draft', label: { es: 'Retirar a borrador', en: 'Back to draft' } };
  if (status === 'published')
    return { target: 'archived', label: { es: 'Despublicar', en: 'Unpublish' } };
  return null;
}

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
        confirmArchive: (title: string) =>
          `¿Despublicar «${title}»? Saldrá del catálogo, pero conservará sus partidas y comentarios.`,
        archivedNotice: 'Tiene reportes abiertos en moderación: lo archivamos en vez de borrarlo.',
        genericError: 'No pudimos completar la acción ahora mismo.',
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
        confirmArchive: (title: string) =>
          `Unpublish "${title}"? It will leave the catalogue, but its plays and comments are kept.`,
        archivedNotice: 'It has open moderation reports, so we archived it instead of deleting it.',
        genericError: 'We could not complete that action right now.',
        emptyTitle: 'You have not created any quizzes yet.',
        emptyBody: 'Your first quiz could be in review within minutes.',
        emptyCta: 'Create a quiz',
      };

  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const failWith = (code: ActionErrorCode) =>
    setErrorMessage(ERROR_LABEL[code]?.[es ? 'es' : 'en'] ?? copy.genericError);

  const remove = async (quiz: MyQuizRow) => {
    if (!window.confirm(copy.confirm(quiz.title))) return;
    setBusyId(quiz.id);
    setErrorMessage(null);
    setNotice(null);
    try {
      const result = await deleteQuiz(quiz.id);
      if (!result.success) return failWith(result.code);
      if (result.archived) setNotice(copy.archivedNotice);
      router.refresh();
    } catch {
      setErrorMessage(copy.genericError);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (
    quiz: MyQuizRow,
    target: 'draft' | 'pending' | 'archived',
    needsConfirm: boolean
  ) => {
    if (needsConfirm && !window.confirm(copy.confirmArchive(quiz.title))) return;
    setBusyId(quiz.id);
    setErrorMessage(null);
    try {
      const result = await setQuizStatus(quiz.id, target);
      if (!result.success) return failWith(result.code);
      router.refresh();
    } catch {
      setErrorMessage(copy.genericError);
    } finally {
      setBusyId(null);
    }
  };

  if (quizzes.length === 0) {
    return (
      <section className="surface-card mt-8 p-10 text-center">
        <h2 className="text-text-primary text-2xl font-semibold">{copy.emptyTitle}</h2>
        <p className="text-text-secondary mt-2">{copy.emptyBody}</p>
        <Link
          href={localizeHref(locale, '/create')}
          className="bg-accent-primary hover:bg-accent-hover text-bg-primary mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium transition-colors"
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
      {notice ? (
        <p
          role="status"
          className="border-warning/40 bg-warning/10 text-warning mb-4 rounded-xl border px-4 py-3 text-sm"
        >
          {notice}
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
              <Link
                href={localizeHref(locale, `/my-quizzes/${quiz.id}/preview`)}
                className="text-text-primary hover:text-accent-primary font-semibold transition-colors"
              >
                {quiz.title}
              </Link>
            );
          const action = statusMove(quiz.status);
          const date = new Date(quiz.created_at).toLocaleDateString(es ? 'es' : 'en-US', {
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
                  {formatCompactNumber(quiz.plays_count, locale)} {copy.plays}
                  {' · '}
                  {formatCompactNumber(quiz.likes_count, locale)} {copy.likes}
                  {' · '}
                  {date}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {action ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={busyId === quiz.id}
                    disabled={busyId !== null}
                    onClick={() => move(quiz, action.target, action.target === 'archived')}
                  >
                    {action.label[es ? 'es' : 'en']}
                  </Button>
                ) : null}
                {quiz.status !== 'published' ? (
                  <Link
                    href={localizeHref(locale, `/my-quizzes/${quiz.id}/edit`)}
                    className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-all duration-200"
                  >
                    {copy.edit}
                  </Link>
                ) : null}
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={busyId === quiz.id}
                  disabled={busyId !== null}
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
