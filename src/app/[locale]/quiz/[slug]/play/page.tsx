import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getQuizBySlug, getQuizLocaleRedirect, getRelatedQuizzes } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeQuizList } from '@/lib/i18n/catalog';
import { toClientQuiz } from '@/lib/quiz/answer-key';
import { parseInitialGameMode } from '@/lib/quiz/game-modes';
import { buildMetadata } from '@/lib/seo/metadata';
import { quizOgImage, resultOgImage } from '@/lib/seo/site';
import { QuizPlayer } from '@/components/quiz/quiz-player';
import { ChallengeBanner } from '@/components/quiz/challenge-banner';
import { challengeCopy, isShareToken } from '@/lib/quiz/challenge';
import {
  getChallengeForQuiz,
  getPersonalityChallengeForQuiz,
  type PersonalityChallenge,
} from '@/lib/data/challenge';
import { fetchGroupByToken, fetchGroupEntries, pickProfileNickname } from '@/lib/data/group';
import { isGroupToken } from '@/lib/quiz/group';
import { createClient } from '@/lib/supabase/server';

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
  searchParams: Promise<{ challenge?: string; g?: string }>;
}): Promise<Metadata> {
  const [{ locale, slug }, { challenge: challengeToken, g: groupToken }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(locale)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  const es = locale === 'es';
  const challenge = isShareToken(challengeToken)
    ? await getChallengeForQuiz(challengeToken, quiz.id)
    : null;
  const group = await groupFromToken(groupToken, quiz.id);
  return buildMetadata({
    title: es ? `Jugando ${quiz.title}` : `Playing ${quiz.title}`,
    description: challenge
      ? challengeCopy(challenge, locale).body
      : group
        ? es
          ? `Entra al grupo de ${group.creatorNickname} en ${quiz.title}.`
          : `Join ${group.creatorNickname}'s group in ${quiz.title}.`
        : quiz.description,
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
  searchParams: Promise<{ challenge?: string; g?: string; mode?: string }>;
}) {
  const [{ locale, slug }, { challenge: challengeToken, g: groupToken, mode }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(locale)) notFound();

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) {
    // Mismo rescate que la ficha. Con reto activo el token pertenece a este
    // quiz: se cambia de idioma, no de quiz, para no perder el marcador.
    const target = await getQuizLocaleRedirect(slug, locale, {
      keepSameQuiz: Boolean(challengeToken || groupToken),
    });
    if (target) {
      const query = new URLSearchParams();
      if (challengeToken) query.set('challenge', challengeToken);
      if (groupToken) query.set('g', groupToken);
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      permanentRedirect(`/${target.locale}/quiz/${target.slug}/play${suffix}`);
    }
    notFound();
  }

  // Un enlace de reto muestra el marcador del retador antes de empezar. Si el
  // token no es de este quiz — o ni siquiera tiene el formato de un share
  // token — se ignora: mejor sin reto que con uno falso.
  // En personality el reto trae además los tags del retador para la tarjeta
  // de compatibilidad que verá el retado al terminar la partida.
  const challenge = isShareToken(challengeToken)
    ? quiz.quiz_type === 'personality'
      ? await getPersonalityChallengeForQuiz(challengeToken, quiz)
      : await getChallengeForQuiz(challengeToken, quiz.id)
    : null;
  const copy = challenge ? challengeCopy(challenge, locale) : null;

  // El enlace `?g=` junta a todos en el ranking del grupo: el aviso nombra al
  // creador y la cantidad de jugadores. Token ajeno al quiz o migración
  // pendiente: se ignora igual que un reto inválido.
  const group = await groupFromToken(groupToken, quiz.id);
  let playerCount = 0;
  if (group) {
    const supabase = await createClient();
    const entriesRead = await fetchGroupEntries(supabase, groupToken!);
    if (entriesRead.state === 'ok') playerCount = entriesRead.value?.length ?? 0;
  }

  // El apodo sugerido viene del perfil solo cuando hay grupo: sin `?g=` la
  // consulta extra no tiene uso.
  let suggestedNickname: string | undefined;
  if (group) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', user.id)
        .maybeSingle();
      suggestedNickname = pickProfileNickname(profile);
    }
  }
  const groupBanner = group
    ? locale === 'es'
      ? {
          eyebrow: 'Ranking del grupo',
          title: `Estás jugando el ranking de ${group.creatorNickname} (${playerCount} jugador${playerCount === 1 ? '' : 'es'})`,
          body: 'Al terminar eliges tu apodo y entras a la tabla del grupo.',
        }
      : {
          eyebrow: 'Group leaderboard',
          title: `You're playing ${group.creatorNickname}'s leaderboard (${playerCount} player${playerCount === 1 ? '' : 's'})`,
          body: 'When you finish, pick a nickname to join the group table.',
        }
    : null;

  // Misma fuente que la ficha y /result; van al cliente, así que pasan por
  // toClientQuiz para no filtrar la clave de respuestas.
  const related = localizeQuizList(
    await getRelatedQuizzes(quiz.slug, quiz.category?.slug, locale),
    locale
  ).map(toClientQuiz);

  // The answer key never leaves the server: the play screen asks the reveal
  // endpoint for one verdict at a time.
  return (
    <>
      {copy ? <ChallengeBanner eyebrow={copy.eyebrow} title={copy.title} body={copy.body} /> : null}
      {groupBanner ? (
        <ChallengeBanner
          eyebrow={groupBanner.eyebrow}
          title={groupBanner.title}
          body={groupBanner.body}
        />
      ) : null}
      <QuizPlayer
        quiz={toClientQuiz(quiz)}
        locale={locale}
        challenge={challenge}
        compatibility={
          quiz.quiz_type === 'personality' ? (challenge as PersonalityChallenge | null) : null
        }
        group={group}
        suggestedNickname={suggestedNickname}
        initialMode={parseInitialGameMode(mode, quiz)}
        related={related}
      />
    </>
  );
}

/**
 * Resuelve el grupo del token `?g=`, acotado al quiz de la URL: el token es
 * público pero un grupo de otro quiz no debe filtrar aquí su existencia. Con
 * migración pendiente (estado 'missing'/'error') el enlace degrada a partida
 * normal, igual que un `?challenge=` inválido.
 */
async function groupFromToken(token: string | undefined, quizId: string) {
  if (!isGroupToken(token)) return null;
  const supabase = await createClient();
  const read = await fetchGroupByToken(supabase, token);
  const group = read.state === 'ok' ? read.value : null;
  return group?.quizId === quizId ? group : null;
}
