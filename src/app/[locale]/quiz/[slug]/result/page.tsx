import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResultScreen } from '@/components/quiz/result-screen';
import { EditorialEmptyState } from '@/components/home/app-placeholders';
import { getQuizBySlug, getQuizSessionByShareToken, getRelatedQuizzes } from '@/lib/data/public';
import { getChallengeForQuiz } from '@/lib/data/challenge';
import { localizeQuizList } from '@/lib/i18n/catalog';
import { buildMetadata } from '@/lib/seo/metadata';
import { resultOgImage, SITE_URL } from '@/lib/seo/site';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildReview, toClientQuiz } from '@/lib/quiz/answer-key';
import { isShareToken } from '@/lib/quiz/challenge';

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
  searchParams: Promise<{ s?: string; challenge?: string }>;
}): Promise<Metadata> {
  const [{ locale, slug }, { s, challenge: challengeToken }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(locale)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  // Solo un token con formato real se consulta y se refleja en metadata; una
  // sesión de otro quiz se trata como inexistente (misma regla que la ruta OG).
  const shareToken = isShareToken(s) ? s : null;
  const found = shareToken ? await getQuizSessionByShareToken(shareToken) : null;
  const session = found?.quiz_id === quiz.id ? found : null;
  const challenge =
    session && isShareToken(challengeToken)
      ? await getChallengeForQuiz(challengeToken, quiz.id)
      : null;

  const es = locale === 'es';

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

  // Facebook y WhatsApp siguen og:url como canonical: sin el token caerían en
  // la página sin sesión y leerían la tarjeta genérica. La página es noindex,
  // así que un canonical auto-referente con token es inocuo.
  const resultPath = `/${locale}/quiz/${encodeURIComponent(quiz.slug)}/result`;
  const query = new URLSearchParams();
  if (session) query.set('s', session.share_token);
  if (challenge) query.set('challenge', challenge.token);
  const path = query.size > 0 ? `${resultPath}?${query.toString()}` : resultPath;

  return buildMetadata({
    title,
    description,
    path,
    image: resultOgImage(locale, quiz.slug, session?.share_token, challenge?.token),
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
  searchParams: Promise<{ s?: string; challenge?: string }>;
}) {
  const [{ locale, slug }, { s, challenge: challengeToken }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(locale)) notFound();

  const shareToken = isShareToken(s) ? s : null;
  const [quiz, found] = await Promise.all([
    getQuizBySlug(slug, locale),
    shareToken ? getQuizSessionByShareToken(shareToken) : Promise.resolve(null),
  ]);

  if (!quiz) notFound();

  // El enlace compartido por el retado lleva el token del retador: la página
  // pinta la comparativa y la tarjeta OG sale como versus. Una sesión de otro
  // quiz cuenta como inexistente (misma regla que la ruta OG): sin sesión de
  // ESTE quiz no hay marcador propio y comparar contra 0 sería inventar un
  // resultado.
  const session = found?.quiz_id === quiz.id ? found : null;
  const challenge =
    session && isShareToken(challengeToken)
      ? await getChallengeForQuiz(challengeToken, quiz.id)
      : null;

  // Sin sesión válida no hay nada que mostrar: ni marcador, ni resultado de
  // personalidad, ni revisión. Un estado vacío honesto con CTA a jugar.
  if (!session) {
    const es = locale === 'es';
    return (
      <div className="arcade-wrap">
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-16">
          <EditorialEmptyState
            eyebrow={es ? 'Resultado' : 'Result'}
            title={es ? 'Aún no has jugado este quiz' : "You haven't played this quiz yet"}
            body={
              es
                ? 'Juega la partida y vuelve con tu enlace de resultado para ver tu marcador y compartirlo.'
                : 'Play the quiz and come back with your result link to see your score and share it.'
            }
            primaryHref={`/${locale}/quiz/${quiz.slug}/play`}
            primaryLabel={es ? 'Jugar ahora' : 'Play now'}
            secondaryHref={`/${locale}/quiz/${quiz.slug}`}
            secondaryLabel={es ? 'Ver la ficha del quiz' : 'View the quiz'}
          />
        </div>
      </div>
    );
  }

  const resolvedResult =
    session.result_id && quiz.results
      ? (quiz.results.find((result) => result.id === session.result_id) ?? null)
      : null;

  const triviaScore =
    quiz.quiz_type === 'trivia'
      ? {
          correct: session.score,
          total: session.max_score,
          percentage:
            session.percentage ??
            (session.max_score > 0 ? Math.round((session.score / session.max_score) * 100) : 0),
        }
      : undefined;

  // Misma fuente que el detalle; van al cliente, así que cada uno pasa por
  // toClientQuiz para no filtrar su clave de respuestas.
  const related = localizeQuizList(
    await getRelatedQuizzes(quiz.slug, quiz.category?.slug, locale),
    locale
  ).map(toClientQuiz);

  return (
    <ResultScreen
      locale={locale}
      quiz={toClientQuiz(quiz)}
      result={resolvedResult}
      triviaScore={triviaScore}
      answers={session.answers ?? []}
      // The review is computed here so the answer key never leaves the server.
      review={buildReview(quiz, session.answers ?? [])}
      shareUrl={`${SITE_URL}/${locale}/quiz/${quiz.slug}/result?s=${session.share_token}${challenge ? `&challenge=${challenge.token}` : ''}`}
      challenge={challenge}
      // Con comparativa activa el reto es contra la marca del retador, no
      // contra la propia sesión.
      challengeHref={`/${locale}/quiz/${quiz.slug}/play?challenge=${challenge?.token ?? session.share_token}`}
      related={related}
    />
  );
}
