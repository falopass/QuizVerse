import 'server-only';

import { pickDailyQuiz } from '@/lib/content/daily-pick';
import { getHomePayload, getLaunchHomePayload } from '@/lib/data/public';
import { localizeQuizList } from '@/lib/i18n/catalog';
import type { Locale } from '@/lib/i18n/dictionaries';

type HomePayload = Awaited<ReturnType<typeof getHomePayload>>;

// Los quizzes únicos que muestra la home, en el orden del payload. Son los
// candidatos del quiz del día: la home y `/[locale]/daily` eligen del mismo
// conjunto, así que apuntan siempre al mismo quiz.
export function collectHomeQuizzes(payload: HomePayload, locale: Locale) {
  return [
    ...new Map(
      localizeQuizList(
        [
          ...payload.featured,
          ...payload.trending,
          ...payload.quickPlays,
          ...payload.freshlyPublished,
        ],
        locale
      ).map((quiz) => [quiz.id, quiz])
    ).values(),
  ];
}

// Slug del quiz de hoy en el idioma, o null si no hay catálogo. Nunca lanza.
export async function getDailyQuizSlug(locale: Locale, date = new Date()): Promise<string | null> {
  const payload = await getHomePayload(locale).catch(() => getLaunchHomePayload(locale));
  return pickDailyQuiz(collectHomeQuizzes(payload, locale), date)?.slug ?? null;
}
