import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatRelativeDate } from '@/lib/utils/format';
import type { QuizStatus, QuizType } from '@/types/database';

/** Cola de publicación, privada: nunca indexada. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Cola de moderación' : 'Moderation queue',
    description: es
      ? 'Quizzes enviados por la comunidad, pendientes de publicación.'
      : 'Community-submitted quizzes pending publication.',
    path: `/${lang}/admin/moderacion`,
    locale: lang,
    noindex: true,
  });
}

const COPY = {
  es: {
    eyebrow: 'Moderación',
    title: 'Cola de moderación',
    intro: 'Quizzes enviados por creadores, esperando publicación o rechazo.',
    reportsLink: 'Ver reportes',
    tabPending: 'Pendientes',
    tabRejected: 'Rechazados',
    empty: 'Nada por aquí. La cola está limpia.',
    loadError: 'No pudimos cargar la cola. Recarga la página para reintentar.',
    uncategorized: 'Sin categoría',
    by: 'por',
    anonymous: 'autor desconocido',
    questions: (n: number) => `${n} preguntas`,
    review: 'Revisar',
    status: {
      pending: 'Pendiente',
      rejected: 'Rechazado',
    },
    type: {
      trivia: 'Trivia',
      personality: 'Personalidad',
      poll: 'Encuesta',
    } satisfies Record<QuizType, string>,
  },
  en: {
    eyebrow: 'Moderation',
    title: 'Moderation queue',
    intro: 'Quizzes submitted by creators, awaiting publication or rejection.',
    reportsLink: 'View reports',
    tabPending: 'Pending',
    tabRejected: 'Rejected',
    empty: 'Nothing here. The queue is clean.',
    loadError: 'We could not load the queue. Reload the page to try again.',
    uncategorized: 'Uncategorized',
    by: 'by',
    anonymous: 'unknown author',
    questions: (n: number) => `${n} questions`,
    review: 'Review',
    status: {
      pending: 'Pending',
      rejected: 'Rejected',
    },
    type: {
      trivia: 'Trivia',
      personality: 'Personality',
      poll: 'Poll',
    } satisfies Record<QuizType, string>,
  },
} as const;

interface QueueRow {
  id: string;
  slug: string;
  title: string;
  status: QuizStatus;
  quiz_type: QuizType;
  language: string;
  question_count: number;
  created_at: string;
  category: { name: string; slug: string } | null;
  creator: { username: string | null; display_name: string | null } | null;
}

type QueueFilter = 'pending' | 'rejected';

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AdminModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/admin/moderacion'))}`
      )
    );
  }
  if (!isAdmin) notFound();

  const { estado } = await searchParams;
  const filter: QueueFilter = estado === 'rejected' ? 'rejected' : 'pending';

  const { data, error } = await supabase
    .from('quizzes')
    .select(
      `id, slug, title, status, quiz_type, language, question_count, created_at,
       category:categories(name, slug),
       creator:profiles!quizzes_creator_id_fkey(username, display_name)`
    )
    .eq('status', filter)
    .order('created_at', { ascending: true })
    .limit(100);

  const quizzes: QueueRow[] = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    quiz_type: row.quiz_type,
    language: row.language,
    question_count: row.question_count,
    created_at: row.created_at,
    category: one(row.category),
    creator: one(row.creator),
  }));

  const copy = COPY[locale as Locale] ?? COPY.en;
  const tabHref = (tab: QueueFilter) =>
    localizeHref(
      locale,
      tab === 'pending' ? '/admin/moderacion' : '/admin/moderacion?estado=rejected'
    );
  const tabClass = (tab: QueueFilter) =>
    `inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors ${
      filter === tab
        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
        : 'border-border-subtle text-text-secondary hover:text-text-primary'
    }`;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.title}
            </h1>
            <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">{copy.intro}</p>
          </div>
          <Link
            href={localizeHref(locale, '/admin/reportes')}
            className="text-accent-primary hover:text-accent-hover mt-2 inline-flex min-h-11 items-center text-sm font-medium transition-colors"
          >
            {copy.reportsLink}
          </Link>
        </div>
        <nav aria-label={copy.title} className="mt-6 flex gap-2">
          <Link
            href={tabHref('pending')}
            className={tabClass('pending')}
            aria-current={filter === 'pending' ? 'page' : undefined}
          >
            {copy.tabPending}
          </Link>
          <Link
            href={tabHref('rejected')}
            className={tabClass('rejected')}
            aria-current={filter === 'rejected' ? 'page' : undefined}
          >
            {copy.tabRejected}
          </Link>
        </nav>
      </section>

      {error ? (
        <section className="surface-panel mt-6 p-8 md:p-10" role="alert">
          <p className="text-error">{copy.loadError}</p>
        </section>
      ) : quizzes.length === 0 ? (
        <section className="surface-panel mt-6 p-8 md:p-10">
          <p className="text-text-secondary">{copy.empty}</p>
        </section>
      ) : (
        <ul className="mt-6 space-y-3">
          {quizzes.map((quiz) => {
            const author = quiz.creator?.display_name ?? quiz.creator?.username ?? copy.anonymous;
            return (
              <li key={quiz.id} className="surface-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={localizeHref(locale, `/admin/quizzes/${quiz.id}`)}
                        className="text-text-primary hover:text-accent-primary font-semibold transition-colors"
                      >
                        {quiz.title}
                      </Link>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          quiz.status === 'rejected'
                            ? 'border-error/50 text-error'
                            : 'border-warning/50 text-warning'
                        }`}
                      >
                        {copy.status[quiz.status as 'pending' | 'rejected'] ?? quiz.status}
                      </span>
                    </div>
                    <p className="text-text-muted mt-2 text-sm">
                      {copy.type[quiz.quiz_type] ?? quiz.quiz_type}
                      {' · '}
                      {quiz.language}
                      {' · '}
                      {quiz.category?.name ?? copy.uncategorized}
                      {' · '}
                      {copy.questions(quiz.question_count)}
                      {' · '}
                      {copy.by} {author}
                      {' · '}
                      {formatRelativeDate(quiz.created_at, locale)}
                    </p>
                  </div>
                  <Link
                    href={localizeHref(locale, `/admin/quizzes/${quiz.id}`)}
                    className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors"
                  >
                    {copy.review}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
