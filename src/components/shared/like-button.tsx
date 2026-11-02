'use client';

/**
 * Botón de "me gusta" de la ficha del quiz.
 *
 * La ficha es estática: al montar pide `getQuizLikeState` (server action) para
 * saber si el usuario actual ya dio like. El toggle es optimista — sube/baja el
 * contador al instante y revierte si `likeQuiz` falla. Sin sesión se renderiza
 * como enlace a login con redirect de vuelta a la ficha.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getQuizLikeState, likeQuiz } from '@/actions/quiz.actions';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: {
    like: 'Me gusta',
    signIn: 'Inicia sesión para dar me gusta',
  },
  en: {
    like: 'Like',
    signIn: 'Sign in to like this quiz',
  },
} as const;

interface LikeButtonProps {
  quizId: string;
  locale: Locale;
  /** Canonical detail path — anonymous users return here after login. */
  detailPath: string;
  initialCount: number;
  className?: string;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function LikeButton({
  quizId,
  locale,
  detailPath,
  initialCount,
  className,
}: LikeButtonProps) {
  const copy = COPY[locale] ?? COPY.en;
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'anonymous' | 'authenticated'>('loading');
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    getQuizLikeState(quizId)
      .then((result) => {
        if (!active) return;
        // `liked: null` = read failed: keep the toggle disabled instead of
        // guessing — a wrong guess could toggle off an existing like while
        // the counter suggests it was added.
        if (!result.authenticated) setState('anonymous');
        else if (result.liked === null) setState('loading');
        else {
          setState('authenticated');
          setLiked(result.liked);
        }
      })
      .catch(() => {
        if (active) setState('loading');
      });
    return () => {
      active = false;
    };
  }, [quizId]);

  const loginHref = `${localizeHref(locale, '/login')}?redirect=${encodeURIComponent(detailPath)}`;
  const classes = [
    'inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2 text-xs font-bold tracking-[0.08em] uppercase transition-colors',
    liked
      ? 'border-accent-tertiary bg-accent-tertiary/15 text-accent-tertiary'
      : 'border-border-subtle text-text-secondary hover:border-accent-tertiary hover:text-accent-tertiary',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (state === 'anonymous') {
    return (
      <Link href={loginHref} aria-label={copy.signIn} className={classes}>
        <HeartIcon filled={false} />
        <span>{count}</span>
      </Link>
    );
  }

  const handleClick = async () => {
    if (pending) return;
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setPending(true);
    try {
      const result = await likeQuiz(quizId);
      if (!result.success) {
        setLiked(prevLiked);
        setCount(prevCount);
        // The session may have expired since the state read.
        if (result.code === 'unauthorized') router.push(loginHref);
        return;
      }
      setLiked(result.liked);
      setCount(result.likesCount ?? prevCount + (result.liked ? 1 : -1));
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || state === 'loading'}
      aria-pressed={liked}
      aria-label={`${copy.like} (${count})`}
      className={classes}
    >
      <HeartIcon filled={liked} />
      <span>{count}</span>
    </button>
  );
}

export default LikeButton;
