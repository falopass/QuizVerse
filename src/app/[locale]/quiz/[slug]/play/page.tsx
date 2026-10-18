import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuizBySlug } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { toClientQuiz } from '@/lib/quiz/answer-key';
import { buildMetadata } from '@/lib/seo/metadata';
import { quizOgImage, resultOgImage } from '@/lib/seo/site';
import { QuizPlayer } from '@/components/quiz/quiz-player';
import { ChallengeBanner } from '@/components/quiz/challenge-banner';
import { challengeCopy } from '@/lib/quiz/challenge';
import { getChallengeForQuiz } from '@/lib/data/challenge';

/**
 * The play view is the same quiz the detail page already ranks for, with no
 * text of its own. Indexing it would only create a duplicate URL, so it keeps
 * the stronger social preview and stays out of the index.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ challenge?: string }>;
}): Promise<Metadata> {
  const [{ locale, slug }, { challenge: challengeToken }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(locale)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  const es = locale === 'es';
  const challenge = challengeToken ? await getChallengeForQuiz(challengeToken, quiz.id) : null;
  return buildMetadata({
    title: es ? `Jugando ${quiz.title}` : `Playing ${quiz.title}`,
    description: challenge ? challengeCopy(challenge, locale).body : quiz.description,
    path: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}/play`,
    // Con reto activo la tarjeta es la marca del retador, no la portada del quiz.
    image: challenge
      ? resultOgImage(locale, quiz.slug, challengeToken)
      : quizOgImage(locale, quiz.slug),
    imageAlt: quiz.title,
    locale,
    noindex: true,
  });
}

export default async function LocalizedQuizPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ challenge?: string }>;
}) {
  const [{ locale, slug }, { challenge: challengeToken }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(locale)) notFound();

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) notFound();

  // Un enlace de reto muestra el marcador del retador antes de empezar. Si el
  // token no es de este quiz, se ignora: mejor sin reto que con uno falso.
  const challenge = challengeToken ? await getChallengeForQuiz(challengeToken, quiz.id) : null;
  const copy = challenge ? challengeCopy(challenge, locale) : null;

  // The answer key never leaves the server: the play screen asks the reveal
  // endpoint for one verdict at a time.
  return (
    <>
      {copy ? <ChallengeBanner eyebrow={copy.eyebrow} title={copy.title} body={copy.body} /> : null}
      <QuizPlayer quiz={toClientQuiz(quiz)} locale={locale} challenge={challenge} />
    </>
  );
}
