/**
 * Historial local de quizzes jugados: últimas partidas en localStorage para la
 * sección «Vuelve a jugar» de la portada. Funciones puras: el storage entra por
 * parámetro para testearlas sin navegador.
 */

export const RECENT_LIMIT = 6;
export const STORAGE_KEY = 'quizverse:recent';

export interface RecentQuiz {
  slug: string;
  title: string;
  quizType: 'trivia' | 'personality';
  categoryName: string | null;
  coverImageUrl: string | null;
  minutes: number;
  /** Marcador listo para pintar: "8/10" en trivia, título del resultado en personality. */
  score?: string | null;
  /** ISO 8601; el orden de la lista es descendente por esta fecha. */
  playedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecentQuiz(value: unknown): value is RecentQuiz {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === 'string' &&
    entry.slug.trim().length > 0 &&
    typeof entry.title === 'string' &&
    entry.title.trim().length > 0 &&
    (entry.quizType === 'trivia' || entry.quizType === 'personality') &&
    (entry.categoryName === null || typeof entry.categoryName === 'string') &&
    (entry.coverImageUrl === null || typeof entry.coverImageUrl === 'string') &&
    typeof entry.minutes === 'number' &&
    (entry.score === undefined || entry.score === null || typeof entry.score === 'string') &&
    typeof entry.playedAt === 'string'
  );
}

function sortAndDedupe(entries: RecentQuiz[]): RecentQuiz[] {
  const sorted = [...entries].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  const seen = new Set<string>();
  return sorted.filter((entry) => {
    if (seen.has(entry.slug)) return false;
    seen.add(entry.slug);
    return true;
  });
}

export function readRecent(storage: StorageLike | null = defaultStorage()): RecentQuiz[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortAndDedupe(parsed.filter(isRecentQuiz)).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Guarda una partida al frente del historial: si el slug ya estaba, se mueve al
 * frente con su `playedAt`/`score` nuevos. Devuelve la lista resultante.
 */
export function recordRecent(
  entry: RecentQuiz,
  storage: StorageLike | null = defaultStorage()
): RecentQuiz[] {
  const current = readRecent(storage);
  if (!isRecentQuiz(entry)) return current;
  const next = [entry, ...current.filter((item) => item.slug !== entry.slug)]
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, RECENT_LIMIT);
  try {
    // Safari privado lanza al escribir: el historial se pierde, la partida no.
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}
