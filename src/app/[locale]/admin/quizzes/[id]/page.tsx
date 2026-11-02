import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ModerationActions } from '@/components/admin/moderation-actions';
import { parseQuestions, parseResults } from '@/lib/data/normalizers';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatRelativeDate } from '@/lib/utils/format';
import type { QuizStatus, ReportReason } from '@/types/database';
import type { PersonalityResult, Question } from '@/types/quiz';

/** Ficha de revisión, privada: nunca indexada. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Revisión de quiz' : 'Quiz review',
    description: es
      ? 'Vista completa de un quiz para moderación, con la clave de respuestas.'
      : 'Full quiz view for moderation, answer key included.',
    path: `/${lang}/admin/quizzes/${id}`,
    locale: lang,
    noindex: true,
  });
}

const COPY = {
  es: {
    backQueue: 'Cola de moderación',
    backReports: 'Reportes',
    by: 'por',
    anonymous: 'autor desconocido',
    uncategorized: 'Sin categoría',
    stats: (plays: number, likes: number) => `${plays} partidas · ${likes} me gusta`,
    minutes: (n: number) => `${n} min`,
    sentAt: 'Enviado',
    publishedAt: 'Publicado',
    openReports: 'Reportes abiertos',
    noReports: 'Sin reportes abiertos para este quiz.',
    reportedBy: 'Reportado por',
    anonymousReporter: 'anónimo',
    registeredReporter: 'cuenta registrada',
    autoResolveNote:
      'Publicar o rechazar este quiz marca como revisados los reportes abiertos que ves aquí.',
    questionsTitle: 'Preguntas y clave',
    answerKeyNote:
      'La respuesta correcta solo se marca aquí, en servidor: nunca sale a un componente de cliente.',
    correct: 'Correcta',
    votesFor: 'suma a',
    explanation: 'Explicación',
    resultsTitle: 'Resultados',
    publicLink: 'Ver página pública',
    aiGenerated: 'Generado con AI',
    featured: 'Destacado',
    loadError: 'No pudimos cargar este quiz. Recarga la página para reintentar.',
    status: {
      draft: 'Borrador',
      pending: 'En revisión',
      published: 'Publicado',
      rejected: 'Rechazado',
      archived: 'Archivado',
    } satisfies Record<QuizStatus, string>,
    type: { trivia: 'Trivia', personality: 'Personalidad', poll: 'Encuesta' },
    difficulty: { easy: 'Fácil', medium: 'Media', hard: 'Difícil' },
    reasons: {
      inappropriate: 'Contenido inapropiado',
      spam: 'Spam o engañoso',
      incorrect_info: 'Información incorrecta',
      hate_speech: 'Discurso de odio',
      copyright: 'Problema de copyright',
      other: 'Otro motivo',
    } satisfies Record<ReportReason, string>,
  },
  en: {
    backQueue: 'Moderation queue',
    backReports: 'Reports',
    by: 'by',
    anonymous: 'unknown author',
    uncategorized: 'Uncategorized',
    stats: (plays: number, likes: number) => `${plays} plays · ${likes} likes`,
    minutes: (n: number) => `${n} min`,
    sentAt: 'Submitted',
    publishedAt: 'Published',
    openReports: 'Open reports',
    noReports: 'No open reports for this quiz.',
    reportedBy: 'Reported by',
    anonymousReporter: 'anonymous',
    registeredReporter: 'signed-in account',
    autoResolveNote:
      'Publishing or rejecting this quiz marks the open reports shown here as reviewed.',
    questionsTitle: 'Questions and answer key',
    answerKeyNote:
      'The correct answer is only marked here, on the server: it never reaches a client component.',
    correct: 'Correct',
    votesFor: 'scores for',
    explanation: 'Explanation',
    resultsTitle: 'Results',
    publicLink: 'View public page',
    aiGenerated: 'AI generated',
    featured: 'Featured',
    loadError: 'We could not load this quiz. Reload the page to try again.',
    status: {
      draft: 'Draft',
      pending: 'In review',
      published: 'Published',
      rejected: 'Rejected',
      archived: 'Archived',
    } satisfies Record<QuizStatus, string>,
    type: { trivia: 'Trivia', personality: 'Personality', poll: 'Poll' },
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    reasons: {
      inappropriate: 'Inappropriate content',
      spam: 'Spam or misleading',
      incorrect_info: 'Incorrect information',
      hate_speech: 'Hate speech',
      copyright: 'Copyright issue',
      other: 'Other',
    } satisfies Record<ReportReason, string>,
  },
} as const;

const STATUS_TONE: Record<QuizStatus, string> = {
  draft: 'border-border-subtle text-text-secondary',
  pending: 'border-warning/50 text-warning',
  published: 'border-success/50 text-success',
  rejected: 'border-error/50 text-error',
  archived: 'border-border-subtle text-text-muted',
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminQuizReviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(locale)) notFound();

  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, `/admin/quizzes/${id}`))}`
      )
    );
  }
  if (!isAdmin || !UUID_RE.test(id)) notFound();

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select(
      `*, category:categories(name, slug),
       creator:profiles!quizzes_creator_id_fkey(username, display_name)`
    )
    .eq('id', id)
    .maybeSingle();

  if (!quiz && !error) notFound();

  if (!quiz) {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
        <section className="surface-panel p-8 md:p-10" role="alert">
          <p className="text-error">{COPY[locale].loadError}</p>
          <Link
            href={localizeHref(locale, '/admin/moderacion')}
            className="text-accent-primary hover:text-accent-hover mt-4 inline-block text-sm font-medium"
          >
            ← {COPY[locale].backQueue}
          </Link>
        </section>
      </div>
    );
  }

  // Sin límite: el veredicto resuelve TODOS los reportes abiertos, así que la
  // ficha tiene que mostrarlos todos (los que no se ven se cerrarían a ciegas).
  const { data: reportRows } = await supabase
    .from('quiz_reports')
    .select('id, reason, details, reporter_id, created_at')
    .eq('quiz_id', quiz.id)
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  const questions: Question[] = parseQuestions(quiz.questions);
  const results: PersonalityResult[] | null = parseResults(quiz.results);
  const category = one(quiz.category);
  const creator = one(quiz.creator);
  const reports = reportRows ?? [];

  const copy = COPY[locale as Locale] ?? COPY.en;
  const quizLocale = hasLocale(quiz.language) ? quiz.language : locale;
  const author = creator?.display_name ?? creator?.username ?? copy.anonymous;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <nav className="text-text-muted flex flex-wrap gap-4 text-sm" aria-label="Admin">
        <Link
          href={localizeHref(locale, '/admin/moderacion')}
          className="hover:text-accent-primary transition-colors"
        >
          ← {copy.backQueue}
        </Link>
        <Link
          href={localizeHref(locale, '/admin/reportes')}
          className="hover:text-accent-primary transition-colors"
        >
          ← {copy.backReports}
        </Link>
      </nav>

      <section className="surface-panel mt-4 p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[quiz.status]}`}
          >
            {copy.status[quiz.status]}
          </span>
          <span className="text-text-muted text-sm">
            {copy.type[quiz.quiz_type] ?? quiz.quiz_type}
            {' · '}
            {copy.difficulty[quiz.difficulty] ?? quiz.difficulty}
            {' · '}
            {quiz.language}
            {' · '}
            {category?.name ?? copy.uncategorized}
          </span>
          {quiz.is_ai_generated ? (
            <span className="border-border-subtle text-text-muted rounded-full border px-3 py-1 text-xs">
              {copy.aiGenerated}
            </span>
          ) : null}
          {quiz.is_featured ? (
            <span className="border-accent-primary/50 text-accent-primary rounded-full border px-3 py-1 text-xs">
              {copy.featured}
            </span>
          ) : null}
        </div>
        <h1 className="text-text-primary mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          {quiz.title}
        </h1>
        {quiz.description ? (
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">{quiz.description}</p>
        ) : null}
        <p className="text-text-muted mt-4 text-sm">
          {copy.by} {author}
          {' · '}
          {copy.sentAt} {formatRelativeDate(quiz.created_at, locale)}
          {quiz.published_at
            ? ` · ${copy.publishedAt} ${formatRelativeDate(quiz.published_at, locale)}`
            : ''}
          {' · '}
          {copy.stats(quiz.plays_count, quiz.likes_count)}
          {' · '}
          {copy.minutes(quiz.estimated_minutes)}
        </p>
        {quiz.tags.length > 0 ? (
          <p className="text-text-muted mt-2 text-sm">{quiz.tags.join(' · ')}</p>
        ) : null}
        {quiz.status === 'published' ? (
          <Link
            href={localizeHref(quizLocale, `/quiz/${quiz.slug}`)}
            className="text-accent-primary hover:text-accent-hover mt-4 inline-block text-sm font-medium transition-colors"
          >
            {copy.publicLink} →
          </Link>
        ) : null}
      </section>

      <ModerationActions
        quizId={quiz.id}
        status={quiz.status}
        locale={locale}
        reportIds={reports.map((report) => report.id)}
      />

      <section className="surface-panel mt-6 p-8 md:p-10">
        <h2 className="text-text-primary text-xl font-semibold">
          {copy.openReports} ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="text-text-secondary mt-3 text-sm">{copy.noReports}</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {reports.map((report) => (
                <li key={report.id} className="border-border-subtle rounded-xl border p-4">
                  <p className="text-text-primary text-sm font-medium">
                    {copy.reasons[report.reason] ?? report.reason}
                  </p>
                  {report.details ? (
                    <p className="text-text-secondary mt-1 text-sm leading-6">{report.details}</p>
                  ) : null}
                  <p className="text-text-muted mt-2 text-xs">
                    {formatRelativeDate(report.created_at, locale)} · {copy.reportedBy}{' '}
                    {report.reporter_id ? copy.registeredReporter : copy.anonymousReporter}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-text-muted mt-4 text-xs">{copy.autoResolveNote}</p>
          </>
        )}
      </section>

      <section className="surface-panel mt-6 p-8 md:p-10">
        <h2 className="text-text-primary text-xl font-semibold">
          {copy.questionsTitle} ({questions.length})
        </h2>
        <p className="text-text-muted mt-2 text-xs">{copy.answerKeyNote}</p>
        <ol className="mt-6 space-y-6">
          {questions.map((question, index) => (
            <li key={question.id ?? index}>
              <p className="text-text-primary font-medium">
                {index + 1}. {question.question}
              </p>
              {question.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={question.image_url}
                  alt=""
                  className="border-border-subtle mt-2 max-h-40 rounded-lg border object-cover"
                />
              ) : null}
              <ul className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <li
                    key={option.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      option.is_correct
                        ? 'border-success/50 bg-success/10 text-text-primary'
                        : 'border-border-subtle text-text-secondary'
                    }`}
                  >
                    <span className="min-w-0">{option.text}</span>
                    {option.is_correct ? (
                      <span className="border-success/50 text-success rounded-full border px-2 py-0.5 text-xs font-semibold">
                        {copy.correct}
                      </span>
                    ) : null}
                    {option.personality_tags?.map((tag) => (
                      <span
                        key={tag}
                        className="border-border-subtle text-text-muted rounded-full border px-2 py-0.5 text-xs"
                      >
                        {copy.votesFor} {tag}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              {question.explanation ? (
                <p className="text-text-muted mt-2 text-sm">
                  {copy.explanation}: {question.explanation}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {results && results.length > 0 ? (
        <section className="surface-panel mt-6 p-8 md:p-10">
          <h2 className="text-text-primary text-xl font-semibold">
            {copy.resultsTitle} ({results.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {results.map((result) => (
              <li key={result.id} className="border-border-subtle rounded-xl border p-4">
                <p className="text-text-primary text-sm font-medium">
                  {result.title}
                  {result.personality_tag ? (
                    <span className="text-text-muted font-normal"> · {result.personality_tag}</span>
                  ) : null}
                </p>
                <p className="text-text-secondary mt-1 text-sm leading-6">{result.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
