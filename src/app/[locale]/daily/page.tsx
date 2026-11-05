import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDailyChallenge } from '@/lib/data/daily-quiz';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { toClientQuiz } from '@/lib/quiz/answer-key';
import { buildMetadata } from '@/lib/seo/metadata';
import { DailyPlayer } from '@/components/daily/daily-player';
import { EditorialEmptyState } from '@/components/home/app-placeholders';
import type { Locale } from '@/lib/i18n/dictionaries';

/**
 * El quiz del día: cinco preguntas de trivia iguales para todos en el idioma,
 * resultado compartible en emojis y racha por dispositivo. La página es
 * indexable y cacheable: el copy es estable (no lista preguntas del día) y lo
 * que depende del jugador — si ya jugó, su racha — se resuelve en el cliente
 * desde localStorage.
 */
const COPY: Record<
  Locale,
  { title: string; description: string; emptyTitle: string; emptyBody: string; emptyCta: string }
> = {
  es: {
    title: 'El quiz diario de QuizVerse',
    description:
      'Cinco preguntas de trivia, el mismo reto para todo el mundo cada día. Comparte tu resultado en emojis y mantén la racha.',
    emptyTitle: 'Hoy no hay reto.',
    emptyBody:
      'Todavía no hay trivia publicada para armar el reto diario. Explora el catálogo mientras tanto.',
    emptyCta: 'Explorar quizzes',
  },
  en: {
    title: 'The QuizVerse daily quiz',
    description:
      'Five trivia questions, the same challenge for everyone every day. Share your result as emojis and keep the streak going.',
    emptyTitle: 'No challenge today.',
    emptyBody:
      'There is no published trivia to build today’s challenge yet. Browse the catalog meanwhile.',
    emptyCta: 'Browse quizzes',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const copy = COPY[locale];
  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/daily`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/daily`,
    locale,
  });
}

export default async function LocalizedDailyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const copy = COPY[locale];

  const challenge = await getDailyChallenge(locale);

  return (
    <div className="arcade-wrap arcade-page">
      {challenge ? (
        <DailyPlayer
          // La clave nunca cruza al navegador: toClientQuiz la quita igual
          // que en /play. El veredicto sale de /api/quiz/reveal y el marcador
          // final lo recalcula submitDailyResult en el servidor.
          quiz={toClientQuiz({ ...challenge.quiz, questions: challenge.questions })}
          locale={locale}
          challengeNumber={challenge.challengeNumber}
          dayKey={challenge.dayKey}
        />
      ) : (
        <EditorialEmptyState
          eyebrow={copy.title}
          title={copy.emptyTitle}
          body={copy.emptyBody}
          primaryHref={localizeHref(locale, '/quiz')}
          primaryLabel={copy.emptyCta}
        />
      )}
    </div>
  );
}
