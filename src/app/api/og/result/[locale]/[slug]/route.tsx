/**
 * Per-result Open Graph card — 1200×630.
 *
 * GET /api/og/result/{locale}/{slug}?s={shareToken}&c={challengeToken}
 *
 * A shared result is the viral unit of the product: it must preview the actual
 * outcome ("I got The Unifier"), not the generic quiz card. With `c` the card
 * becomes a versus (retador vs retado), which is what a challenge link shares
 * once the challenged friend has played. Falls back to the quiz card when the
 * tokens are missing or unknown.
 *
 * Cached aggressively: the content is immutable per share token.
 */

import { ImageResponse } from 'next/og';
import { arcadeOgOptions } from '@/lib/seo/og-font';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getQuizBySlug, getQuizSessionByShareToken } from '@/lib/data/public';
import { getChallengeForQuiz } from '@/lib/data/challenge';
import { buildQuizCoverSvg } from '@/lib/design/cover-svg';
import { getLocalizedCategoryLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { challengeOutcome, type ChallengeScore } from '@/lib/quiz/challenge';
import type { Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#101019';
const LIME = '#d9ff43';
const PAPER = '#f6f3ff';
const VIOLET = '#8458ff';

type OgOptions = Awaited<ReturnType<typeof arcadeOgOptions>>;
type Session = NonNullable<Awaited<ReturnType<typeof getQuizSessionByShareToken>>>;

function baseCover(quizTitle: string, options: OgOptions) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: INK,
        color: LIME,
        fontSize: 68,
        fontFamily: 'Archivo Black',
      }}
    >
      QUIZVERSE · {quizTitle}
    </div>,
    options
  );
}

function coverPanel(quiz: Quiz) {
  const cover = `data:image/svg+xml;base64,${Buffer.from(buildQuizCoverSvg(quiz)).toString('base64')}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: 370,
        overflow: 'hidden',
        border: `8px solid ${LIME}`,
        background: VIOLET,
        transform: 'rotate(3deg)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt=""
        width="370"
        height="480"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}

function eyebrowLine(quiz: Quiz, locale: Locale): string {
  const parts: string[] = [getLocalizedTypeLabel(quiz.quiz_type, locale)];
  if (quiz.category) parts.push(getLocalizedCategoryLabel(quiz.category.slug, locale));
  parts.push(`${quiz.estimated_minutes} MIN`);
  return parts.join(' / ');
}

function topRow(tag: string) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          fontSize: 30,
          fontFamily: 'Archivo Black',
          letterSpacing: '-0.06em',
        }}
      >
        QUIZ<span style={{ color: LIME }}>VERSE</span>
      </div>
      <div
        style={{
          display: 'flex',
          border: `2px solid ${LIME}`,
          borderRadius: 999,
          padding: '10px 20px',
          color: LIME,
          fontSize: 18,
          fontFamily: 'Archivo Black',
          letterSpacing: '0.14em',
        }}
      >
        {tag}
      </div>
    </div>
  );
}

function bottomRow(cta: string) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '2px solid #474558',
        paddingTop: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          borderRadius: 999,
          padding: '14px 22px',
          background: LIME,
          color: INK,
          fontSize: 20,
          fontFamily: 'Archivo Black',
          letterSpacing: '0.02em',
        }}
      >
        {cta}
      </div>
      <div style={{ display: 'flex', fontSize: 20, color: '#aaa9bd' }}>quizverse.org</div>
    </div>
  );
}

function resultCard(
  quiz: Quiz,
  session: Session | null,
  locale: Locale,
  options: OgOptions,
  headers: Record<string, string>
) {
  const es = locale === 'es';
  const isTrivia = quiz.quiz_type === 'trivia';
  const scoreLine =
    isTrivia && session
      ? `${session.score} / ${session.max_score}`
      : isTrivia
        ? `${quiz.questions.length} ${es ? 'PREGUNTAS' : 'QUESTIONS'}`
        : null;

  const headline = session?.result_title ?? quiz.title;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 52,
        gap: 36,
        background: INK,
        color: PAPER,
      }}
    >
      <div
        style={{
          width: 690,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {topRow(es ? 'RESULTADO' : 'RESULT')}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              color: LIME,
              fontSize: 20,
              fontFamily: 'Archivo Black',
              letterSpacing: '0.16em',
            }}
          >
            {eyebrowLine(quiz, locale)}
          </div>
          {scoreLine && (
            <div
              style={{
                display: 'flex',
                marginTop: 10,
                fontSize: 76,
                lineHeight: 1,
                fontFamily: 'Archivo Black',
                letterSpacing: '-0.06em',
                color: PAPER,
              }}
            >
              {scoreLine}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              marginTop: scoreLine ? 10 : 18,
              maxHeight: 300,
              overflow: 'hidden',
              fontSize: headline.length > 46 ? 50 : headline.length > 30 ? 62 : 76,
              lineHeight: 1,
              fontFamily: 'Archivo Black',
              letterSpacing: '-0.05em',
            }}
          >
            {headline}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              maxHeight: 120,
              overflow: 'hidden',
              fontSize: 26,
              color: '#d0cddb',
            }}
          >
            {session?.result_title ? quiz.title : es ? '¿Puedes superarlo?' : 'Can you beat it?'}
          </div>
        </div>

        {bottomRow(es ? 'JUEGA EL TUYO >' : 'PLAY YOURS >')}
      </div>

      {coverPanel(quiz)}
    </div>,
    { ...options, headers }
  );
}

function mark(score: ChallengeScore): string {
  return score.maxScore > 0 ? `${score.score}/${score.maxScore}` : (score.resultTitle ?? '—');
}

function versusCard(
  quiz: Quiz,
  session: Session,
  challenger: ChallengeScore,
  locale: Locale,
  options: OgOptions,
  headers: Record<string, string>
) {
  const es = locale === 'es';
  const mine: ChallengeScore = {
    score: session.score,
    maxScore: session.max_score,
    resultTitle: session.result_title,
  };
  const outcome = challengeOutcome(mine, challenger);
  const verdict =
    outcome === 'win'
      ? es
        ? 'RETO SUPERADO'
        : 'CHALLENGE BEATEN'
      : outcome === 'tie'
        ? es
          ? 'EMPATE'
          : 'TIE'
        : es
          ? 'EL RETO SIGUE EN PIE'
          : 'THE CHALLENGE STANDS';

  const side = (role: string, value: string, accent: boolean) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        border: `3px solid ${accent ? LIME : '#474558'}`,
        borderRadius: 20,
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          fontFamily: 'Archivo Black',
          letterSpacing: '0.16em',
          color: accent ? LIME : '#aaa9bd',
        }}
      >
        {role}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 8,
          fontSize: value.length > 10 ? 44 : 64,
          lineHeight: 1,
          fontFamily: 'Archivo Black',
          letterSpacing: '-0.05em',
          color: accent ? LIME : PAPER,
        }}
      >
        {value}
      </div>
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 52,
        gap: 36,
        background: INK,
        color: PAPER,
      }}
    >
      <div
        style={{
          width: 690,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {topRow(es ? 'RETO' : 'CHALLENGE')}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              color: LIME,
              fontSize: 20,
              fontFamily: 'Archivo Black',
              letterSpacing: '0.16em',
            }}
          >
            {eyebrowLine(quiz, locale)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 14,
              fontSize: verdict.length > 18 ? 52 : 68,
              lineHeight: 1,
              fontFamily: 'Archivo Black',
              letterSpacing: '-0.05em',
              color: LIME,
            }}
          >
            {verdict}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 24 }}>
            {side(es ? 'RETADOR' : 'CHALLENGER', mark(challenger), false)}
            {side(es ? 'RETADO' : 'CHALLENGED', mark(mine), true)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              maxHeight: 74,
              overflow: 'hidden',
              fontSize: 26,
              color: '#d0cddb',
            }}
          >
            {quiz.title}
          </div>
        </div>

        {bottomRow(es ? 'TU REVANCHA >' : 'YOUR REMATCH >')}
      </div>

      {coverPanel(quiz)}
    </div>,
    { ...options, headers }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> }
) {
  const { locale, slug } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('s');
  const challengeToken = searchParams.get('c');
  const options = await arcadeOgOptions();
  const headers = {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  };

  const quiz = await getQuizBySlug(slug, uiLocale);
  if (!quiz) {
    return baseCover('QuizVerse', options);
  }

  const session = token ? await getQuizSessionByShareToken(token) : null;
  const challenger = challengeToken ? await getChallengeForQuiz(challengeToken, quiz.id) : null;

  if (session && challenger) {
    return versusCard(quiz, session, challenger, uiLocale, options, headers);
  }

  return resultCard(quiz, session, uiLocale, options, headers);
}
