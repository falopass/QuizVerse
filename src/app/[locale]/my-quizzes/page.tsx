import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MyQuizzesList } from '@/components/quiz/my-quizzes-list';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

const PAGE_SIZE = 20;

/** Creator's own submissions, private and login-gated: never indexed. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Mis quizzes' : 'My quizzes',
    description: es
      ? 'Borradores, revisiones y publicados: revisa el estado de tus quizzes.'
      : 'Drafts, submissions and published quizzes: check the status of yours.',
    path: `/${lang}/my-quizzes`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedMyQuizzesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ locale }, { page: rawPage }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/my-quizzes'))}`
      )
    );
  }

  const requested = Number.parseInt(rawPage ?? '1', 10);
  const page = Number.isSafeInteger(requested) && requested >= 1 ? requested : 1;
  const from = (page - 1) * PAGE_SIZE;
  const {
    data: quizzes,
    error,
    count,
  } = await supabase
    .from('quizzes')
    .select('id, slug, title, status, quiz_type, language, plays_count, likes_count, created_at', {
      count: 'exact',
    })
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const es = locale === 'es';
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Borrar el último quiz de una página deja `?page` fuera de rango: sin esto
  // la lista saldría vacía aunque queden quizzes en la página anterior.
  if (!error && page > pageCount) {
    redirect(localizeHref(locale, pageCount > 1 ? `/my-quizzes?page=${pageCount}` : '/my-quizzes'));
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Estudio' : 'Studio'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Mis quizzes' : 'My quizzes'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Borradores, revisiones y publicados: edita, previsualiza, despublica o borra lo que necesites.'
            : 'Drafts, submissions and published quizzes: edit, preview, unpublish or delete what you need.'}
        </p>
      </section>
      {error ? (
        <section className="surface-card mt-8 p-10 text-center">
          <h2 className="text-text-primary text-2xl font-semibold">
            {es ? 'No pudimos cargar tus quizzes.' : 'We could not load your quizzes.'}
          </h2>
          <p className="text-text-secondary mt-2">
            {es ? 'Inténtalo de nuevo en un momento.' : 'Please try again in a moment.'}
          </p>
          <Link
            href={localizeHref(locale, '/my-quizzes')}
            className="bg-accent-primary hover:bg-accent-hover text-bg-primary mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium transition-colors"
          >
            {es ? 'Reintentar' : 'Retry'}
          </Link>
        </section>
      ) : (
        <>
          <MyQuizzesList quizzes={quizzes ?? []} locale={locale} />
          {pageCount > 1 ? (
            <nav
              aria-label={es ? 'Paginación' : 'Pagination'}
              className="mt-8 flex items-center justify-center gap-4"
            >
              {page > 1 ? (
                <Link
                  href={localizeHref(locale, `/my-quizzes?page=${page - 1}`)}
                  className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-all duration-200"
                >
                  {es ? 'Anterior' : 'Previous'}
                </Link>
              ) : null}
              <span className="text-text-muted text-sm">
                {es ? `Página ${page} de ${pageCount}` : `Page ${page} of ${pageCount}`}
              </span>
              {page < pageCount ? (
                <Link
                  href={localizeHref(locale, `/my-quizzes?page=${page + 1}`)}
                  className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-all duration-200"
                >
                  {es ? 'Siguiente' : 'Next'}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
