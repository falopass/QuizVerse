'use client';

/**
 * Sección de comentarios de la ficha del quiz.
 *
 * La ficha es estática: la lista se pide al montar con `getQuizComments` y el
 * alta va a `createComment` (server action). Si la lectura falla se muestra el
 * estado vacío — la página nunca se rompe por esta sección.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createComment, getQuizComments, type QuizComment } from '@/actions/comments.actions';
import { useSupabase } from '@/providers/supabase-provider';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: {
    title: 'Comentarios',
    empty: 'Sé la primera persona en comentar.',
    loading: 'Cargando comentarios…',
    placeholder: 'Escribe un comentario…',
    submit: 'Comentar',
    submitting: 'Publicando…',
    signIn: 'Inicia sesión para comentar',
    error: 'No pudimos publicar tu comentario. Inténtalo otra vez.',
    rateLimited: 'Estás comentando muy rápido. Espera un momento.',
    count: (n: number) => (n === 1 ? '1 comentario' : `${n} comentarios`),
  },
  en: {
    title: 'Comments',
    empty: 'Be the first to comment.',
    loading: 'Loading comments…',
    placeholder: 'Write a comment…',
    submit: 'Comment',
    submitting: 'Posting…',
    signIn: 'Sign in to comment',
    error: 'We could not post your comment. Please try again.',
    rateLimited: 'You are commenting too fast. Please wait.',
    count: (n: number) => (n === 1 ? '1 comment' : `${n} comments`),
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
  const [comments, setComments] = useState<QuizComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQuizComments(quizId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await createComment(quizId, body);
      if (result.success) {
        setComments((prev) => [result.comment, ...(prev ?? [])]);
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

  const loginHref = localizeHref(locale, `/login?redirect=${encodeURIComponent(pathname || '/')}`);

  return (
    <section className="arcade-related" aria-labelledby="quiz-comments">
      <div className="arcade-section-head">
        <h2 id="quiz-comments">{copy.title}</h2>
        <p aria-live="polite">{comments === null ? copy.loading : copy.count(comments.length)}</p>
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

      {comments === null ? null : comments.length === 0 ? (
        <p className="text-text-muted text-sm">{copy.empty}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="border-border-subtle bg-bg-secondary flex gap-3 rounded-[4px] border p-4"
            >
              <AuthorAvatar author={comment.author} />
              <div className="min-w-0">
                <p className="text-text-secondary flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="text-text-primary font-semibold">
                    @{comment.author?.username ?? '…'}
                  </span>
                  {comment.author?.display_name ? <span>{comment.author.display_name}</span> : null}
                  <time dateTime={comment.created_at} className="text-text-muted">
                    {relativeDate(comment.created_at, locale)}
                  </time>
                </p>
                <p className="text-text-primary mt-1 text-sm leading-6 whitespace-pre-wrap">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default QuizComments;
