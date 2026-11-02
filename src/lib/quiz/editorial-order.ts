import type { Quiz } from '@/types/quiz';

/**
 * Campos que necesitan el score y la selección editorial. Los comparten el
 * `Quiz` completo (home, ficha) y la fila liviana del explorador.
 */
export type EditorialQuiz = Pick<
  Quiz,
  'id' | 'quiz_type' | 'is_featured' | 'cover_image_url' | 'plays_count' | 'likes_count'
>;

export function editorialScore(quiz: EditorialQuiz): number {
  const featuredBoost = quiz.is_featured ? 220 : 0;
  const stockBoost = quiz.cover_image_url?.startsWith('/stock-covers/') ? 28 : 0;
  const personalityBoost = quiz.quiz_type === 'personality' ? 6 : 0;
  return (
    featuredBoost + stockBoost + quiz.plays_count * 2 + quiz.likes_count * 4 + personalityBoost
  );
}

export interface ExplorerSelection<T extends EditorialQuiz> {
  lead: T | null;
  pulse: T | null;
  lanes: T[];
  grid: T[];
  rest: T[];
}

/**
 * What the explorer shows for a given quiz list, already ordered as the
 * caller wants the lanes and grid to follow: a lead card, a pulse card, up
 * to 4 lane cards and up to 30 grid cards — 36 quizzes at most — plus the
 * remaining pool in `rest` for the "show more" expansion.
 * `preferEditorial` (default) gives the lead slot to a featured quiz and the
 * pulse slot to the best-scored remaining quiz; `false` takes both straight
 * from list order (the "most played" view).
 */
export function explorerSelection<T extends EditorialQuiz>(
  quizzes: T[],
  { preferEditorial = true }: { preferEditorial?: boolean } = {}
): ExplorerSelection<T> {
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
    grid: secondary.slice(4, 34),
    rest: secondary.slice(34),
  };
}

/**
 * The quizzes visible in the default explorer view, in display order
 * (lead, pulse, lanes, grid). Single source for the page's ItemList JSON-LD.
 */
export function explorerVisibleQuizzes<T extends EditorialQuiz>(quizzes: T[]): T[] {
  const sorted = [...quizzes].sort((a, b) => editorialScore(b) - editorialScore(a));
  const { lead, pulse, lanes, grid } = explorerSelection(sorted);
  return [lead, pulse, ...lanes, ...grid].filter((quiz): quiz is T => quiz !== null);
}
