import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResultScreen } from '@/components/quiz/result-screen';
import { getQuizBySlug, getQuizSessionByShareToken } from '@/lib/data/public';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/seo/site';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildReview, toClientQuiz } from '@/lib/quiz/answer-key';

/** Absolute URL of the per-result share card. */
function resultOgImage(locale: string, slug: string, token?: string): string {
  const base = `${SITE_URL}/api/og/result/${locale}/${encodeURIComponent(slug)}`;
  return token ? `${base}?s=${encodeURIComponent(token)}` : base;
}

/**
 * Result URLs carry a per-player share token and render one person's outcome,
 * so they must never be indexed. They keep proper Open Graph tags because this
 * is exactly the URL people paste into chats — and the card is generated from
 * the outcome, not from the quiz.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ s?: string }>;
}): Promise<Metadata> {
  const [{ locale, slug }, { s }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  const es = locale === 'es';
  const session = s ? await getQuizSessionByShareToken(s) : null;

  // The card headline is the outcome: the personality result, or the score.
  const outcome = session?.result_title
    ? session.result_title
    : session && quiz.quiz_type === 'trivia'
      ? `${session.score}/${session.max_score}`
      : null;

  const title = outcome
    ? es
      ? `${outcome} · ${quiz.title}`
      : `${outcome} · ${quiz.title}`
    : es
      ? `Mi resultado en ${quiz.title}`
      : `My result in ${quiz.title}`;

  const description = outcome
    ? es
      ? `Conseguí ${outcome} en ${quiz.title}. ¿Puedes superarlo?`
      : `I got ${outcome} in ${quiz.title}. Can you beat it?`
    : quiz.description;

  return buildMetadata({
    title,
    description,
    path: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}/result`,
    image: resultOgImage(locale, quiz.slug, s),
    imageAlt: outcome ?? quiz.title,
    locale,
    noindex: true,
  });
}
export default async function LocalizedQuizResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const [{ locale, slug }, { s }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();

  const [quiz, session] = await Promise.all([
    getQuizBySlug(slug, locale),
    s ? getQuizSessionByShareToken(s) : Promise.resolve(null),
  ]);

  if (!quiz) notFound();

  const resolvedResult =
    session?.result_id && quiz.results
      ? (quiz.results.find((result) => result.id === session.result_id) ?? null)
      : (quiz.results?.[0] ?? null);

  const triviaScore =
    quiz.quiz_type === 'trivia'
      ? {
          correct: session?.score ?? 0,
          total: session?.max_score ?? quiz.questions.length,
          percentage:
            session?.percentage ??
            (quiz.questions.length > 0
              ? Math.round(((session?.score ?? 0) / quiz.questions.length) * 100)
              : 0),
        }
      : undefined;

  return (
    <ResultScreen
      locale={locale}
      quiz={toClientQuiz(quiz)}
      result={resolvedResult}
      triviaScore={triviaScore}
      answers={session?.answers ?? []}
      // The review is computed here so the answer key never leaves the server.
      review={buildReview(quiz, session?.answers ?? [])}
      shareUrl={s ? `/${locale}/quiz/${quiz.slug}/result?s=${s}` : undefined}
    />
  );
}
