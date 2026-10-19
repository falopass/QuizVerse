import type { Quiz } from '@/types/quiz';

export function editorialScore(quiz: Quiz): number {
  const featuredBoost = quiz.is_featured ? 220 : 0;
  const stockBoost = quiz.cover_image_url?.startsWith('/stock-covers/') ? 28 : 0;
  const personalityBoost = quiz.quiz_type === 'personality' ? 6 : 0;
  return (
    featuredBoost + stockBoost + quiz.plays_count * 2 + quiz.likes_count * 4 + personalityBoost
  );
}

export interface ExplorerSelection {
  lead: Quiz | null;
  pulse: Quiz | null;
  lanes: Quiz[];
  grid: Quiz[];
  rest: Quiz[];
}

/**
 * What the explorer shows for a given quiz list, already ordered as the
 * caller wants the lanes and grid to follow: a lead card, a pulse card, up
 * to 4 lane cards and up to 12 grid cards — 18 quizzes at most — plus the
 * remaining pool in `rest` for the "show more" expansion.
 * `preferEditorial` (default) gives the lead slot to a featured quiz and the
 * pulse slot to the best-scored remaining quiz; `false` takes both straight
 * from list order (the "most played" view).
 */
export function explorerSelection(
  quizzes: Quiz[],
  { preferEditorial = true }: { preferEditorial?: boolean } = {}
): ExplorerSelection {
  const lead = preferEditorial
    ? (quizzes.find((quiz) => quiz.is_featured) ?? quizzes[0] ?? null)
    : (quizzes[0] ?? null);
  const pool = quizzes.filter((quiz) => quiz.id !== lead?.id);
  const pulse = preferEditorial
    ? ([...pool].sort((a, b) => editorialScore(b) - editorialScore(a))[0] ?? null)
    : (pool[0] ?? null);
  const secondary = pool.filter((quiz) => quiz.id !== pulse?.id);
  return {
    lead,
    pulse,
    lanes: secondary.slice(0, 4),
    grid: secondary.slice(4, 16),
    rest: secondary.slice(16),
  };
}

/**
 * The quizzes visible in the default explorer view, in display order
 * (lead, pulse, lanes, grid). Single source for the page's ItemList JSON-LD.
 */
export function explorerVisibleQuizzes(quizzes: Quiz[]): Quiz[] {
  const sorted = [...quizzes].sort((a, b) => editorialScore(b) - editorialScore(a));
  const { lead, pulse, lanes, grid } = explorerSelection(sorted);
  return [lead, pulse, ...lanes, ...grid].filter((quiz): quiz is Quiz => quiz !== null);
}
