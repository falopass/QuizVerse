import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { ReportButton } from '@/components/shared/report-button';
import { QuizComments } from '@/components/quiz/quiz-comments';
import { InviteBar } from '@/components/shared/invite-bar';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getPublishedQuizzes, getQuizBySlug, getRelatedQuizzes } from '@/lib/data/public';
import { getStockCoverEntry } from '@/lib/data/stock-cover-manifest';
import { LAUNCH_QUIZZES } from '@/lib/data/launch-catalog';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocaleFromParam } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/navigation';
import {
  getLocalizedLanguageLabel,
  getLocalizedTypeLabel,
  localizeQuizCategory,
} from '@/lib/i18n/catalog';
import { clampDescription } from '@/lib/seo/metadata';
import { SITE_URL, quizOgImage } from '@/lib/seo/site';
import {
  breadcrumbNode,
  buildGraph,
  categoryPath,
  quizNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';

interface QuizDetailPageProps {
  params: Promise<{ locale?: string; slug: string }>;
}

/** How much of the quiz we preview. Enough to be useful, short enough to keep the page fast. */
const PREVIEW_QUESTIONS = 3;
const PREVIEW_RESULTS = 6;

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
  const stored = await getQuizBySlug(slug, locale);
  if (!stored) notFound();

  // Category names are localized for display, breadcrumbs and JSON-LD.
  const quiz = localizeQuizCategory(stored, locale);
  const related = await getRelatedQuizzes(quiz.slug, quiz.category?.slug, locale);
  const stockCover = getStockCoverEntry(quiz.slug);

  const es = locale === 'es';
  const typeSlug =
    quiz.quiz_type === 'trivia' || quiz.quiz_type === 'personality' ? quiz.quiz_type : null;
  const parent = typeSlug
    ? {
        name: getLocalizedTypeLabel(quiz.quiz_type, locale),
        href: `/${locale}/category/${typeSlug}`,
      }
    : quiz.category
      ? { name: quiz.category.name, href: categoryPath(locale, quiz.category.slug) }
      : null;

  const trail: Array<{ name: string; href?: string }> = [
    { name: es ? 'Inicio' : 'Home', href: `/${locale}` },
    { name: dictionary.common.explore, href: `/${locale}/quiz` },
    ...(parent ? [parent] : []),
    { name: quiz.title },
  ];

  const canonicalPath = quizPath(locale, quiz.slug);
  const questions = quiz.questions.slice(0, PREVIEW_QUESTIONS);
  const results = quiz.results?.slice(0, PREVIEW_RESULTS) ?? [];

  return (
    <div className="arcade-wrap arcade-page arcade-detail-page">
      <JsonLd
        data={buildGraph([
          webPageNode(canonicalPath, locale, quiz.title),
          quizNode({
            quiz,
            locale,
            category: quiz.category ?? null,
            description: clampDescription(quiz.description),
            imageUrl: quizOgImage(locale, quiz.slug),
          }),
          breadcrumbNode(
            trail.map((item) => ({ name: item.name, path: item.href ?? canonicalPath }))
          ),
        ])}
      />
      <Breadcrumbs items={trail} locale={locale} className="mb-6" />
      <section className="arcade-detail">
        <div>
          <QuizCoverArt
            quiz={quiz}
            locale={locale}
            decorative
            className="arcade-detail-art"
            priorityLabel=""
          />
          {stockCover && quiz.cover_image_url?.startsWith('/stock-covers/') && (
            <p className="arcade-attribution">{stockCover.attribution}</p>
          )}
        </div>
        <div className="arcade-detail-copy">
          <Link href={localizeHref(locale, '/quiz')} className="arcade-back">
            {dictionary.arcade.backGames}
          </Link>
          <h1>{quiz.title}</h1>
          <p>{quiz.description}</p>
          <Link
            href={localizeHref(locale, `/quiz/${quiz.slug}/play`)}
            className="arcade-button arcade-button-lime arcade-start"
          >
            {dictionary.arcade.startPlaying} <span>↗</span>
          </Link>
          <dl className="arcade-facts">
            <div>
              <dt>{dictionary.arcade.gameType}</dt>
              <dd>{getLocalizedTypeLabel(quiz.quiz_type, locale)}</dd>
            </div>
            <div>
              <dt>{dictionary.common.questionsShort}</dt>
              <dd>{quiz.questions.length}</dd>
            </div>
            <div>
              <dt>{dictionary.arcade.time}</dt>
              <dd>{quiz.estimated_minutes} min</dd>
            </div>
            <div>
              <dt>{dictionary.arcade.language}</dt>
              <dd>{getLocalizedLanguageLabel(quiz.language, locale)}</dd>
            </div>
            {quiz.category && (
              <div>
                <dt>{es ? 'Categoría' : 'Category'}</dt>
                <dd>
                  <Link
                    href={categoryPath(locale, quiz.category.slug)}
                    className="text-accent-primary underline-offset-2 hover:underline"
                  >
                    {quiz.category.name}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          <div className="arcade-report">
            <ReportButton quizId={quiz.id} quizSlug={quiz.slug} locale={locale} />
          </div>
          <InviteBar
            url={`${SITE_URL}${canonicalPath}`}
            quizTitle={quiz.title}
            locale={locale}
            labels={{
              invite: dictionary.arcade.invite,
              inviteBody: dictionary.arcade.inviteBody,
              copyInvite: dictionary.arcade.copyInvite,
              copied: dictionary.arcade.copied,
            }}
          />
        </div>
      </section>

      {questions.length > 0 && (
        <section className="arcade-related" aria-labelledby="inside-quiz">
          <div className="arcade-section-head">
            <h2 id="inside-quiz">{es ? 'Dentro del quiz' : 'Inside the quiz'}</h2>
            <p>
              {es
                ? `Las primeras ${questions.length} preguntas reales de ${quiz.title}.`
                : `The first ${questions.length} real questions in ${quiz.title}.`}
            </p>
          </div>
          <ol className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {questions.map((question, index) => (
              <li
                key={question.id ?? index}
                className="border-border-subtle bg-bg-secondary rounded-[4px] border p-5"
              >
                <span className="text-accent-primary text-[10px] font-bold tracking-[0.18em] uppercase">
                  {String(index + 1).padStart(2, '0')} / {quiz.questions.length}
                </span>
                <p className="text-text-primary mt-2 text-base leading-snug font-semibold">
                  {question.question}
                </p>
                {question.options.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {question.options.slice(0, 4).map((option, optionIndex) => (
                      <li
                        key={option.id ?? optionIndex}
                        className="border-border-subtle text-text-secondary rounded-full border px-3 py-1 text-xs"
                      >
                        {option.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {results.length > 0 && (
        <section className="arcade-related" aria-labelledby="possible-results">
          <div className="arcade-section-head">
            <h2 id="possible-results">{es ? 'Resultados posibles' : 'Possible results'}</h2>
            <p>
              {es
                ? `Te puede tocar cualquiera de estos ${quiz.results?.length ?? results.length}. Depende de cómo respondas.`
                : `You can land on any of these ${quiz.results?.length ?? results.length}. It depends on how you answer.`}
            </p>
          </div>
          <ul className="flex flex-wrap gap-3">
            {results.map((result) => (
              <li
                key={result.id}
                className="border-border-subtle bg-bg-secondary text-accent-primary rounded-full border px-4 py-2 text-sm font-semibold"
              >
                {result.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {quiz.category && (
        <section className="arcade-related">
          {related.length > 0 && (
            <>
              <div className="arcade-section-head">
                <h2>{dictionary.arcade.related}</h2>
              </div>
              <div className="arcade-grid">
                {related.slice(0, 3).map((item) => (
                  <EditorialQuizCard key={item.id} quiz={item} locale={locale} />
                ))}
              </div>
            </>
          )}
          <Link
            href={categoryPath(locale, quiz.category.slug)}
            className="arcade-back mt-6 inline-block"
          >
            {es
              ? `Ver todos los quizzes de ${quiz.category.name} ↗`
              : `See all ${quiz.category.name} quizzes ↗`}
          </Link>
        </section>
      )}

      {/* Los quizzes del catálogo de respaldo (`launch-*`) no existen en la DB:
          sin fila en `quizzes` no hay comentarios que leer ni escribir. */}
      {z.string().uuid().safeParse(quiz.id).success && (
        <QuizComments quizId={quiz.id} locale={locale} />
      )}
    </div>
  );
}
