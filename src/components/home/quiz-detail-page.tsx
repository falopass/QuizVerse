import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { ReportButton } from '@/components/shared/report-button';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getPublishedQuizzes, getQuizBySlug, getRelatedQuizzes } from '@/lib/data/public';
import { getStockCoverEntry } from '@/lib/data/stock-cover-manifest';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocaleFromParam } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/navigation';
import {
  getLocalizedCategoryLabel,
  getLocalizedDifficultyLabel,
  getLocalizedLanguageLabel,
  getLocalizedTypeLabel,
} from '@/lib/i18n/catalog';

interface QuizDetailPageProps {
  params: Promise<{ locale?: string; slug: string }>;
}

export async function generateQuizDetailStaticParams() {
  try {
    const quizzes = await getPublishedQuizzes(80);
    return quizzes.map((quiz) => ({ slug: quiz.slug }));
  } catch {
    return LAUNCH_QUIZZES.map((quiz) => ({ slug: quiz.slug }));
  }
}

export async function QuizDetailPage({ params }: QuizDetailPageProps) {
  const { slug, locale: localeParam } = await params;
  const locale = getLocaleFromParam(localeParam);
  const dictionary = await getDictionary(locale);
  const quiz = await getQuizBySlug(slug, locale);

  if (!quiz) {
    notFound();
  }

  const related = await getRelatedQuizzes(quiz.slug, quiz.category?.slug, locale);
  const categoryLabel = getLocalizedCategoryLabel(quiz.category?.slug ?? 'culture', locale);
  const stockCover = getStockCoverEntry(quiz.slug);

  return (
    <main className="px-4 pt-28 pb-20">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="grid items-start gap-7 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="surface-panel overflow-hidden p-5 md:p-6">
            <QuizCoverArt
              quiz={quiz}
              locale={locale}
              priorityLabel={
                quiz.is_featured
                  ? locale === 'es'
                    ? 'Selección principal'
                    : 'Lead selection'
                  : undefined
              }
              ratioClassName="aspect-[16/9]"
            />
            <div className="mt-5 grid gap-3 md:grid-cols-[0.88fr_0.12fr]">
              <div className="border-border-subtle bg-bg-primary/75 rounded-[1.5rem] border px-5 py-5">
                <p className="text-text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
                  {locale === 'es' ? 'Promesa editorial' : 'Editorial promise'}
                </p>
                <p className="text-text-secondary mt-3 text-base leading-7">
                  {quiz.quiz_type === 'personality'
                    ? locale === 'es'
                      ? 'Una lectura rápida, compartible y con mejor payoff visual al final.'
                      : 'A fast, shareable read with a stronger visual payoff at the end.'
                    : locale === 'es'
                      ? 'Trivia clara, ritmo corto y suficiente tensión para querer terminarla de una vez.'
                      : 'Clear trivia, short pacing, and enough tension to make you finish it in one go.'}
                </p>
              </div>
              <div className="border-border-subtle bg-bg-primary/75 rounded-[1.5rem] border px-5 py-5">
                <p className="text-text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
                  {locale === 'es' ? 'Ritmo' : 'Pace'}
                </p>
                <p className="text-text-primary mt-3 text-3xl font-semibold">
                  {quiz.estimated_minutes}m
                </p>
              </div>
            </div>
            {stockCover ? (
              <p className="text-text-muted mt-4 text-xs leading-5">
                {locale === 'es' ? 'Foto de referencia' : 'Reference photo'}:{' '}
                {stockCover.attribution}
              </p>
            ) : null}
          </div>

          <div className="space-y-5 lg:pt-2">
            <div className="surface-panel p-7 md:p-8">
              <p className="eyebrow">{dictionary.detail.eyebrow}</p>
              <h1 className="text-text-primary mt-4 max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
                {quiz.title}
              </h1>
              <p className="balanced-copy text-text-secondary mt-5 max-w-xl text-lg leading-8">
                {quiz.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <span className="border-border-subtle bg-bg-primary text-text-muted rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {getLocalizedTypeLabel(quiz.quiz_type, locale)}
                </span>
                <span className="border-border-subtle bg-bg-primary text-text-muted rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {getLocalizedDifficultyLabel(quiz.difficulty, locale)}
                </span>
                <span className="border-border-subtle bg-bg-primary text-text-muted rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {getLocalizedLanguageLabel(quiz.language, locale)}
                </span>
                <span className="border-border-subtle bg-bg-primary text-text-muted rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {categoryLabel}
                </span>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label={dictionary.detail.duration}
                  value={`${quiz.estimated_minutes} ${locale === 'es' ? 'min' : 'min'}`}
                />
                <StatCard
                  label={dictionary.detail.plays}
                  value={quiz.plays_count.toLocaleString(locale)}
                />
                <StatCard
                  label={dictionary.detail.likes}
                  value={quiz.likes_count.toLocaleString(locale)}
                />
                <StatCard
                  label={locale === 'es' ? 'Preguntas' : 'Questions'}
                  value={String(quiz.questions.length)}
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={localizeHref(locale, `/quiz/${quiz.slug}/play`)}
                  className="bg-accent-primary hover:bg-accent-hover inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                >
                  {dictionary.detail.primaryCta}
                </Link>
                <Link
                  href={localizeHref(locale, '/quiz')}
                  className="border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/50 inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
                >
                  {dictionary.detail.secondaryCta}
                </Link>
                <div className="text-text-secondary inline-flex items-center justify-center rounded-full border border-transparent px-2 py-2 text-sm font-semibold">
                  <ReportButton quizId={quiz.id} quizSlug={quiz.slug} locale={locale} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InsightCard
                eyebrow={dictionary.detail.preview}
                title={dictionary.detail.whatToExpect}
                body={
                  quiz.quiz_type === 'personality'
                    ? locale === 'es'
                      ? 'Cada respuesta mueve el resultado hacia un arquetipo distinto y deja una salida más compartible.'
                      : 'Each answer nudges the run toward a distinct archetype and a more shareable finish.'
                    : locale === 'es'
                      ? 'Respuestas claras, feedback directo y ritmo de juego pensado para entrar rápido.'
                      : 'Clear right and wrong answers, direct feedback, and pacing built for fast entry.'
                }
              />
              <InsightCard
                eyebrow={locale === 'es' ? 'Contexto' : 'Context'}
                title={locale === 'es' ? 'Por qué entra bien' : 'Why it lands fast'}
                body={
                  locale === 'es'
                    ? 'Este quiz está pensado para móvil, con lectura ágil, pregunta visible y una recompensa clara al final.'
                    : 'This quiz is tuned for mobile with quick reading, visible prompts, and a clear payoff at the end.'
                }
              />
            </div>
            <div className="surface-card p-6 md:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="kicker">
                    {locale === 'es' ? 'Antes de jugar' : 'Before you start'}
                  </p>
                  <h2 className="font-display text-text-primary mt-2 text-3xl">
                    {locale === 'es' ? 'Lo importante en un vistazo' : 'What matters in one glance'}
                  </h2>
                </div>
                <span className="bg-accent-primary/10 text-accent-primary rounded-full px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase">
                  {quiz.quiz_type === 'personality'
                    ? locale === 'es'
                      ? 'resultado compartible'
                      : 'shareable finish'
                    : locale === 'es'
                      ? 'feedback claro'
                      : 'clean feedback'}
                </span>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <ValueChip
                  title={locale === 'es' ? 'Entrada' : 'Entry'}
                  body={
                    locale === 'es'
                      ? 'Se entiende rápido incluso si no vienes con contexto perfecto.'
                      : 'It reads fast even if you are not carrying perfect context in.'
                  }
                />
                <ValueChip
                  title={locale === 'es' ? 'Ritmo' : 'Pacing'}
                  body={
                    locale === 'es'
                      ? 'Preguntas visibles, lectura ágil y progresión pensada para móvil.'
                      : 'Visible prompts, quick reading, and pacing tuned for mobile.'
                  }
                />
                <ValueChip
                  title={locale === 'es' ? 'Salida' : 'Payoff'}
                  body={
                    quiz.quiz_type === 'personality'
                      ? locale === 'es'
                        ? 'Termina en un resultado con más identidad y mejor potencial para compartir.'
                        : 'Ends in a result with more identity and stronger sharing potential.'
                      : locale === 'es'
                        ? 'Te da una lectura clara de qué tanto sabes en pocos minutos.'
                        : 'Gives you a clean read on how much you know in just a few minutes.'
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="surface-card p-6 md:p-7">
            <p className="kicker">{dictionary.detail.questionPreview}</p>
            <h2 className="font-display text-text-primary mt-3 text-3xl">
              {dictionary.detail.previewHeadline}
            </h2>
            <div className="text-text-secondary mt-6 space-y-3 text-sm leading-6">
              <p>
                {locale === 'es'
                  ? `${quiz.questions.length} preguntas con ritmo corto, diseñadas para terminarse rápido sin perder claridad.`
                  : `${quiz.questions.length} questions with short pacing, designed to finish fast without losing clarity.`}
              </p>
              <p>
                {locale === 'es'
                  ? `Idioma: ${getLocalizedLanguageLabel(quiz.language, locale)}.`
                  : `Language: ${getLocalizedLanguageLabel(quiz.language, locale)}.`}
              </p>
              <p>
                {locale === 'es'
                  ? `Categoría editorial: ${categoryLabel}.`
                  : `Editorial lane: ${categoryLabel}.`}
              </p>
            </div>
          </div>

          <div className="surface-card p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="kicker">{locale === 'es' ? 'Vista rápida' : 'Quick look'}</p>
                <h2 className="font-display text-text-primary mt-2 text-3xl">
                  {locale === 'es'
                    ? 'Tres preguntas para entrar al mood'
                    : 'Three questions to set the mood'}
                </h2>
              </div>
              <span className="bg-accent-primary/10 text-accent-primary rounded-full px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase">
                {quiz.questions.length} {locale === 'es' ? 'ítems' : 'items'}
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              {quiz.questions.slice(0, 3).map((question, index) => (
                <div
                  key={question.id}
                  className="border-border-subtle bg-bg-primary rounded-[1.5rem] border px-5 py-5"
                >
                  <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
                    {locale === 'es' ? 'Pregunta' : 'Question'} {index + 1}
                  </p>
                  <p className="text-text-primary mt-3 text-lg font-medium">{question.question}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {question.options.slice(0, 4).map((option) => (
                      <div
                        key={option.id}
                        className="border-border-subtle bg-bg-secondary text-text-secondary rounded-2xl border px-4 py-3 text-sm"
                      >
                        {option.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{dictionary.detail.relatedEyebrow}</p>
                <h2 className="font-display text-text-primary mt-2 text-4xl">
                  {dictionary.detail.relatedHeadline}
                </h2>
              </div>
              <Link
                href={localizeHref(locale, '/quiz')}
                className="text-text-primary decoration-border-strong text-sm font-semibold underline underline-offset-4"
              >
                {dictionary.detail.secondaryCta}
              </Link>
            </div>
            <div className="grid items-start gap-5 md:grid-cols-3">
              {related.map((relatedQuiz, index) => (
                <EditorialQuizCard
                  key={relatedQuiz.id}
                  quiz={relatedQuiz}
                  index={index}
                  locale={locale}
                  size="compact"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-subtle bg-bg-primary/80 rounded-[1.5rem] border p-5">
      <p className="text-text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
        {label}
      </p>
      <p className="text-text-primary mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function InsightCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="surface-card p-6">
      <p className="kicker">{eyebrow}</p>
      <h3 className="font-display text-text-primary mt-3 text-2xl">{title}</h3>
      <p className="text-text-secondary mt-4 text-sm leading-6">{body}</p>
    </div>
  );
}

function ValueChip({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border-subtle bg-bg-primary rounded-[1.4rem] border px-5 py-5">
      <p className="text-text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
        {title}
      </p>
      <p className="text-text-secondary mt-3 text-sm leading-6">{body}</p>
    </div>
  );
}
