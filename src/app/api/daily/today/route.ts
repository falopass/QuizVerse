/**
 * GET /api/daily/today?locale=es
 *
 * El reto vigente, sin caché. La página `/daily` es ISR y puede servir el reto
 * anterior unos minutos después de la medianoche de Chile; el reproductor la
 * consulta cuando su `dayKey` quedó viejo y se queda con la selección fresca.
 *
 * Devuelve el quiz saneado por `toClientQuiz`: preguntas sí, clave nunca.
 */

import { NextResponse } from 'next/server';
import { getDailyChallenge } from '@/lib/data/daily-quiz';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { toClientQuiz } from '@/lib/quiz/answer-key';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? '';
  if (!hasLocale(locale)) {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 });
  }

  const challenge = await getDailyChallenge(locale);
  if (!challenge) {
    return NextResponse.json({ error: 'no_challenge' }, { status: 404 });
  }

  return NextResponse.json(
    {
      quiz: toClientQuiz({ ...challenge.quiz, questions: challenge.questions }),
      challengeNumber: challenge.challengeNumber,
      dayKey: challenge.dayKey,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
