import { notFound } from 'next/navigation';
import { ResultScreen } from '@/components/quiz/result-screen';
import { getQuizBySlug, getQuizSessionByShareToken } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';

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
          quiz={quiz}
          result={resolvedResult}
          triviaScore={triviaScore}
          answers={session?.answers ?? []}
          shareUrl={s ? `/${locale}/quiz/${quiz.slug}/result?s=${s}` : undefined}
        />
  );
}
