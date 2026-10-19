import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuizBySlug } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { toClientQuiz } from '@/lib/quiz/answer-key';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/seo/site';
import { quizPath } from '@/lib/seo/structured-data';
import { QuizPlayer } from '@/components/quiz/quiz-player';

/**
 * Frameable quiz player (`/embed/{locale}/{slug}`) for third-party embeds.
 *
 * It lives outside `[locale]` on purpose: no SiteShell, so no nav, no footer,
 * just the game and a link back. `X-Frame-Options` is lifted for this subtree
 * in next.config.ts (DENY everywhere else), and the page stays noindex: the
 * canonical quiz page is the one that ranks.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  return buildMetadata({
    title: quiz.title,
    description: quiz.description,
    path: `/embed/${locale}/${encodeURIComponent(quiz.slug)}`,
    locale,
    noindex: true,
  });
}

export default async function EmbedQuizPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) notFound();

  const es = locale === 'es';
  const quizUrl = `${SITE_URL}${quizPath(locale, quiz.slug)}`;

  // The answer key never leaves the server — same rule as /play.
  return (
    <main>
      <QuizPlayer quiz={toClientQuiz(quiz)} locale={locale} />
      <p className="pb-5 text-center text-xs text-[var(--text-secondary)]">
        <a
          href={quizUrl}
          target="_blank"
          rel="noopener"
          className="text-[var(--accent-primary)] hover:underline"
        >
          {es ? `Juega “${quiz.title}” en QuizVerse` : `Play “${quiz.title}” on QuizVerse`}
        </a>
      </p>
    </main>
  );
}
