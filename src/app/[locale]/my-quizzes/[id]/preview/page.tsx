import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { toClientQuiz } from '@/lib/quiz/answer-key';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/quiz/quiz-status';
import { normalizeCategory, normalizeQuiz, type QuizRow } from '@/lib/data/normalizers';
import {
  getLocalizedLanguageLabel,
  getLocalizedTypeLabel,
  localizeQuizCategory,
} from '@/lib/i18n/catalog';
import type { CategoryRow } from '@/lib/data/normalizers';

/** Author-only preview of a quiz in any state: private, never indexed. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Vista previa del quiz' : 'Quiz preview',
    description: es
      ? 'Así verán tu quiz las personas jugadoras una vez publicado.'
      : 'This is how players will see your quiz once it is published.',
    path: `/${lang}/my-quizzes/${id}/preview`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedQuizPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const previewHref = localizeHref(locale, `/my-quizzes/${id}/preview`);
  if (!user) {
    redirect(localizeHref(locale, `/login?redirect=${encodeURIComponent(previewHref)}`));
  }

  const { data: row } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .eq('creator_id', user.id)
    .maybeSingle();

  if (!row) notFound();

  const quizRow = row as QuizRow;
  const { data: categoryRow } = quizRow.category_id
    ? await supabase.from('categories').select('*').eq('id', quizRow.category_id).maybeSingle()
    : { data: null };

  const categories = new Map(
    categoryRow ? [[categoryRow.id, normalizeCategory(categoryRow as CategoryRow)]] : []
  );
  // The answer key is stripped even though every child is a server component:
  // the quiz stays safe the day any piece below becomes a client island.
  const quiz = toClientQuiz(localizeQuizCategory(normalizeQuiz(quizRow, categories), locale));

  const es = locale === 'es';
  const copy = es
    ? {
        eyebrow: 'Vista previa',
        banner:
          'Solo tú puedes ver esta página. Así quedará la pieza cuando esté publicada: las partidas no se juegan ni se cuentan desde aquí.',
        edit: 'Editar datos',
        back: 'Volver a Mis quizzes',
        questions: 'Preguntas',
        options: 'opciones',
        results: 'Resultados posibles',
        empty: 'Este quiz todavía no tiene preguntas.',
        difficulty: 'Dificultad',
        minutes: 'min',
        addsTo: 'Suma a',
        difficultyLabel: { easy: 'Fácil', medium: 'Media', hard: 'Difícil' } as const,
      }
    : {
        eyebrow: 'Preview',
        banner:
          'Only you can see this page. This is what the piece will look like once published: games are not played or counted from here.',
        edit: 'Edit details',
        back: 'Back to My quizzes',
        questions: 'Questions',
        options: 'options',
        results: 'Possible results',
        empty: 'This quiz has no questions yet.',
        difficulty: 'Difficulty',
        minutes: 'min',
        addsTo: 'Adds to',
        difficultyLabel: { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const,
      };

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">{copy.eyebrow}</p>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[quiz.status]}`}
          >
            {STATUS_LABEL[quiz.status][es ? 'es' : 'en']}
          </span>
        </div>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {quiz.title}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">{copy.banner}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={localizeHref(locale, `/my-quizzes/${id}/edit`)}
            className="bg-accent-primary hover:bg-accent-hover text-bg-primary inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors"
          >
            {copy.edit}
          </Link>
          <Link
            href={localizeHref(locale, '/my-quizzes')}
            className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-all duration-200"
          >
            {copy.back}
          </Link>
        </div>
      </section>

      <section className="surface-panel mt-6 overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[0.4fr_0.6fr]">
          <QuizCoverArt quiz={quiz} locale={locale} className="h-full" decorative />
          <div className="p-8">
            {quiz.description ? (
              <p className="text-text-secondary leading-7">{quiz.description}</p>
            ) : null}
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-text-muted">{es ? 'Formato' : 'Format'}</dt>
                <dd className="text-text-primary mt-1 font-semibold">
                  {getLocalizedTypeLabel(quiz.quiz_type, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">{copy.difficulty}</dt>
                <dd className="text-text-primary mt-1 font-semibold">
                  {copy.difficultyLabel[quiz.difficulty]}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">{es ? 'Duración' : 'Duration'}</dt>
                <dd className="text-text-primary mt-1 font-semibold">
                  {quiz.estimated_minutes} {copy.minutes}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">{es ? 'Idioma' : 'Language'}</dt>
                <dd className="text-text-primary mt-1 font-semibold">
                  {getLocalizedLanguageLabel(quiz.language, locale)}
                </dd>
              </div>
            </dl>
            {quiz.category ? (
              <p className="text-text-muted mt-4 text-sm">{quiz.category.name}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-text-primary text-2xl font-semibold">
          {copy.questions} · {quiz.questions.length}
        </h2>
        {quiz.questions.length === 0 ? (
          <p className="text-text-secondary mt-4">{copy.empty}</p>
        ) : (
          <ol className="mt-6 space-y-4">
            {quiz.questions.map((question, index) => (
              <li key={question.id} className="surface-card p-5">
                <span className="text-accent-primary text-[10px] font-bold tracking-[0.18em] uppercase">
                  {String(index + 1).padStart(2, '0')} / {quiz.questions.length}
                </span>
                <p className="text-text-primary mt-2 text-base leading-snug font-semibold">
                  {question.question}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <li
                      key={option.id}
                      className="border-border-subtle text-text-secondary rounded-full border px-3 py-1 text-xs"
                    >
                      {option.text}
                      {option.personality_tags?.length ? (
                        <span className="text-text-muted">
                          {' '}
                          · {copy.addsTo} {option.personality_tags.join(', ')}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {question.explanation ? (
                  <p className="text-text-muted mt-3 text-sm">{question.explanation}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {quiz.results?.length ? (
        <section className="mt-10">
          <h2 className="text-text-primary text-2xl font-semibold">{copy.results}</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {quiz.results.map((item) => (
              <li key={item.id} className="surface-card p-5">
                <p className="text-text-primary font-semibold">{item.title}</p>
                {item.personality_tag ? (
                  <p className="text-text-muted mt-1 text-xs">{item.personality_tag}</p>
                ) : null}
                <p className="text-text-secondary mt-2 text-sm leading-6">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
