/**
 * Per-result Open Graph card — 1200×630.
 *
 * GET /api/og/result/{locale}/{slug}?s={shareToken}
 *
 * A shared result is the viral unit of the product: it must preview the actual
 * outcome ("I got The Unifier"), not the generic quiz card. Falls back to the
 * quiz card when the token is missing or unknown.
 *
 * Cached aggressively: the content is immutable per share token.
 */

import { ImageResponse } from 'next/og';
import { arcadeOgOptions } from '@/lib/seo/og-font';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getQuizBySlug, getQuizSessionByShareToken } from '@/lib/data/public';
import { buildQuizCoverSvg } from '@/lib/design/cover-svg';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#101019';
const LIME = '#d9ff43';
const PAPER = '#f6f3ff';

function baseCover(
  quizTitle: string,
  es: boolean,
  options: Awaited<ReturnType<typeof arcadeOgOptions>>
) {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> }
) {
  const { locale, slug } = await params;
  const uiLocale = hasLocale(locale) ? locale : 'en';
  const es = uiLocale === 'es';
  const token = new URL(request.url).searchParams.get('s');
  const options = await arcadeOgOptions();

  const quiz = await getQuizBySlug(slug, uiLocale);
  if (!quiz) {
    return baseCover('QuizVerse', es, options);
  }

  const session = token ? await getQuizSessionByShareToken(token) : null;
  const cover = `data:image/svg+xml;base64,${Buffer.from(buildQuizCoverSvg(quiz)).toString('base64')}`;

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
            {es ? 'RESULTADO' : 'RESULT'}
          </div>
        </div>

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
            {getLocalizedTypeLabel(quiz.quiz_type, uiLocale)} / {quiz.estimated_minutes} MIN
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
            {es ? 'JUEGA EL TUYO >' : 'PLAY YOURS >'}
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#aaa9bd' }}>quizverse.org</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: 370,
          overflow: 'hidden',
          border: `8px solid ${LIME}`,
          background: '#8458ff',
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
    </div>,
    {
      ...options,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}
