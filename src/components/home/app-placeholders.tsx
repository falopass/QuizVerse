import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import type { Locale } from '@/lib/i18n/dictionaries';

export type LoadingStageVariant =
  | 'home'
  | 'explore'
  | 'leaderboard'
  | 'me'
  | 'notifications'
  | 'settings'
  | 'my-quizzes'
  | 'admin';

const ERROR_BOUNDARY_COPY = {
  en: {
    eyebrow: 'Error',
    title: 'Something interrupted the flow.',
    body: 'The page could not finish loading. Try again, or jump back into the catalog.',
    retry: 'Try again',
    home: 'Go home',
    browse: 'Browse quizzes',
  },
  es: {
    eyebrow: 'Error',
    title: 'Algo interrumpió el flujo.',
    body: 'La página no pudo terminar de cargar. Intenta de nuevo o vuelve al catálogo.',
    retry: 'Reintentar',
    home: 'Ir al inicio',
    browse: 'Explorar quizzes',
  },
} as const;

/** Copy ligero de error para boundaries cliente sin arrastrar `dictionaries.ts`. */
export function getErrorBoundaryCopy(locale: Locale) {
  return ERROR_BOUNDARY_COPY[locale] ?? ERROR_BOUNDARY_COPY.en;
}

export function EditorialLoadingStage({
  eyebrow = 'Loading',
  title = 'Preparing the next surface.',
  body = 'We are pulling in the latest data and shaping the page for you.',
  variant = 'home',
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  variant?: LoadingStageVariant;
}) {
  const maxWidthClass =
    variant === 'settings'
      ? 'max-w-3xl'
      : variant === 'me' ||
          variant === 'notifications' ||
          variant === 'my-quizzes' ||
          variant === 'admin'
        ? 'max-w-5xl'
        : 'max-w-6xl';

  return (
    <div className="min-h-[70vh] px-4 pt-6 pb-16 md:pt-10">
      <p role="status" aria-live="polite" className="sr-only">
        {eyebrow}: {title}
      </p>
      <div className={`mx-auto ${maxWidthClass} space-y-6`} aria-busy="true">
        {variant === 'home' ? (
          <>
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="surface-panel flex min-h-[340px] flex-col justify-between p-6 md:p-8">
                <div className="space-y-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-14 w-4/5" />
                  <Skeleton className="h-14 w-3/5" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
                <Skeleton className="mt-8 h-12 w-48 rounded-full" />
              </div>
              <div className="surface-card min-h-[260px] p-6 md:min-h-[340px]">
                <Skeleton className="h-full min-h-[220px] w-full" />
              </div>
            </section>
            <Skeleton className="h-11 w-full" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </>
        ) : variant === 'explore' ? (
          <>
            <section className="surface-panel p-6 md:p-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-11 w-2/3 max-w-md" />
              <Skeleton className="mt-3 h-5 w-1/2 max-w-sm" />
              <Skeleton className="mt-6 h-12 w-full" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-32 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
            </section>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </>
        ) : variant === 'leaderboard' ? (
          <>
            <section className="surface-panel p-6 md:p-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-11 w-2/3 max-w-md" />
              <Skeleton className="mt-3 h-5 w-3/5 max-w-lg" />
              <div className="mt-6 flex flex-wrap gap-2">
                <Skeleton className="h-11 w-24 rounded-full" />
                <Skeleton className="h-11 w-24 rounded-full" />
                <Skeleton className="h-11 w-24 rounded-full" />
              </div>
            </section>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="surface-card flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton variant="circular" className="h-10 w-10" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </>
        ) : variant === 'me' ? (
          <>
            <section className="surface-panel p-6 md:p-8">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-11 w-56" />
              <Skeleton className="mt-3 h-5 w-80 max-w-full" />
              <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="surface-card p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-3 h-8 w-14" />
                </div>
                <div className="surface-card p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-3 h-8 w-16" />
                </div>
                <div className="surface-card p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-3 h-8 w-20" />
                </div>
              </div>
            </section>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="surface-card flex items-center justify-between gap-4 p-5"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-56 max-w-[60vw]" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </>
        ) : variant === 'notifications' ? (
          <>
            <section className="surface-panel p-6 md:p-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-11 w-64 max-w-full" />
              <Skeleton className="mt-3 h-5 w-96 max-w-full" />
            </section>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-40 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="surface-card flex gap-3 p-4">
                  <Skeleton variant="circular" className="mt-1.5 h-2.5 w-2.5 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : variant === 'settings' ? (
          <>
            <section className="surface-panel p-6 md:p-8">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-10 w-64 max-w-full" />
            </section>
            <section className="surface-card space-y-5 p-6 md:p-8">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-11 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
              <Skeleton className="h-11 w-40 rounded-full" />
            </section>
            <section className="surface-card space-y-4 p-6 md:p-8">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-72 max-w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-44 rounded-full" />
            </section>
          </>
        ) : variant === 'my-quizzes' || variant === 'admin' ? (
          <>
            <section className="surface-panel p-6 md:p-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-11 w-64 max-w-full" />
              <Skeleton className="mt-3 h-5 w-96 max-w-full" />
              {variant === 'admin' ? (
                <div className="mt-6 flex gap-2">
                  <Skeleton className="h-11 w-28 rounded-full" />
                  <Skeleton className="h-11 w-28 rounded-full" />
                </div>
              ) : null}
            </section>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-56 max-w-[60vw]" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-64 max-w-full" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-24 rounded-full" />
                    <Skeleton className="h-9 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <section className="surface-panel p-6 md:p-8">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="font-display text-text-primary mt-3 max-w-3xl text-3xl font-normal md:text-5xl">
              {title}
            </h1>
            <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">{body}</p>
          </section>
        )}
      </div>
    </div>
  );
}

export function EditorialEmptyState({
  eyebrow = 'Empty',
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  tertiaryHref,
  tertiaryLabel,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  tertiaryHref?: string;
  tertiaryLabel?: string;
}) {
  return (
    <div className="surface-card p-8 text-center sm:p-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display text-text-primary mt-3 text-3xl font-normal sm:text-4xl">
        {title}
      </h1>
      <p className="text-text-secondary mx-auto mt-4 max-w-2xl text-base leading-7">{body}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="bg-accent-primary hover:bg-accent-hover text-bg-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary inline-flex min-h-11 items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
          >
            {secondaryLabel}
          </Link>
        ) : null}
        {tertiaryHref && tertiaryLabel ? (
          // No prefetch: the only tertiary link in use is /{locale}/random, a
          // 307 route handler — prefetching would cache its destination (same
          // trick as the nav's "Surprise me" link in floating-nav.tsx).
          <Link
            href={tertiaryHref}
            prefetch={false}
            className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary inline-flex min-h-11 items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
          >
            {tertiaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function EditorialErrorState({
  eyebrow = 'Error',
  title = 'Something interrupted the flow.',
  body = 'The page could not finish loading. Try again, or jump back into the catalog.',
  onRetry,
  showRetry = true,
  retryLabel = 'Try again',
  homeHref = '/',
  homeLabel = 'Go home',
  browseHref = '/quiz',
  browseLabel = 'Browse quizzes',
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  onRetry?: () => void;
  showRetry?: boolean;
  retryLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  browseHref?: string;
  browseLabel?: string;
}) {
  return (
    <div className="min-h-[70vh] px-4 pt-6 pb-16 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <div className="surface-panel p-8 text-center md:p-10">
          <div className="border-border-subtle bg-bg-primary text-error mx-auto flex h-16 w-16 items-center justify-center rounded-[4px] border text-3xl font-bold">
            !
          </div>
          <p className="eyebrow mt-6">{eyebrow}</p>
          <h1 className="font-display text-text-primary mt-3 text-3xl font-normal sm:text-4xl">
            {title}
          </h1>
          <p className="text-text-secondary mx-auto mt-4 max-w-2xl text-base leading-7">{body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {showRetry && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="bg-accent-primary hover:bg-accent-hover text-bg-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
              >
                {retryLabel}
              </button>
            ) : null}
            <Link
              href={homeHref}
              className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary inline-flex min-h-11 items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
            >
              {homeLabel}
            </Link>
            <Link
              href={browseHref}
              className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary inline-flex min-h-11 items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
            >
              {browseLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="surface-card overflow-hidden">
      <Skeleton variant="rectangular" className="h-[168px] w-full" />
      <div className="p-4">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="mt-3 h-6 w-4/5" />
        <Skeleton className="mt-2 h-6 w-3/5" />
        <div className="mt-5 flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
