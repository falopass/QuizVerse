import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export function EditorialLoadingStage({
  eyebrow = 'Loading',
  title = 'Preparing the next surface.',
  body = 'We are pulling in the latest data and shaping the page for you.',
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
}) {
  return (
    <div className="min-h-[70vh] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="surface-panel p-8 md:p-10">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-text-primary mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            {title}
          </h1>
          <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">{body}</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-card p-6">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="mt-5 h-14 w-4/5 rounded-2xl" />
            <Skeleton className="mt-4 h-5 w-full rounded-full" />
            <Skeleton className="mt-3 h-5 w-3/4 rounded-full" />
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-24 rounded-[1.5rem]" />
              <Skeleton className="h-24 rounded-[1.5rem]" />
              <Skeleton className="h-24 rounded-[1.5rem]" />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </section>
        </div>
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
}: {
  eyebrow?: string;
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="surface-card p-10 text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-text-primary mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="text-text-secondary mx-auto mt-4 max-w-2xl text-base leading-7">{body}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function EditorialErrorState({
  title = 'Something interrupted the flow.',
  body = 'The page could not finish loading. Try again, or jump back into the catalog.',
  onRetry,
  showRetry = true,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}) {
  return (
    <div className="min-h-[70vh] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-3xl">
        <div className="surface-panel p-8 text-center md:p-10">
          <div className="border-border-subtle bg-bg-primary text-text-primary mx-auto flex h-20 w-20 items-center justify-center rounded-full border text-3xl font-black">
            !
          </div>
          <p className="eyebrow mt-6">Error</p>
          <h1 className="text-text-primary mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="text-text-secondary mx-auto mt-4 max-w-2xl text-base leading-7">{body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {showRetry && onRetry ? (
              <button
                onClick={onRetry}
                className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                Try again
              </button>
            ) : null}
            <Link
              href="/"
              className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
            >
              Go home
            </Link>
            <Link
              href="/quiz"
              className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
            >
              Browse quizzes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="surface-card p-5">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="mt-4 h-8 w-4/5 rounded-2xl" />
      <Skeleton className="mt-3 h-4 w-full rounded-full" />
      <Skeleton className="mt-2 h-4 w-3/4 rounded-full" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}
