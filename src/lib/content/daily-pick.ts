import type { Locale } from '@/lib/i18n/dictionaries';

// El día editorial es el de Chile: la rotación cae a medianoche local y no a
// medianoche UTC, que en Chile son las 20:00 o 21:00 según el horario de verano.
const DAILY_TIME_ZONE = 'America/Santiago';
const MS_PER_DAY = 86_400_000;

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: DAILY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dayKey(date: Date): string {
  const parts = DAY_FORMATTER.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

// Días de calendario desde epoch. Sale de la fecha local y no del instante, así
// que los días de 23 o 25 horas por el cambio de hora siguen siendo consecutivos.
function dayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

// El índice rota sobre los candidatos ordenados por id: el resultado no depende
// del orden de entrada (la home llega ordenada por plays_count, que cambia con
// cada partida) y con más de un candidato dos días seguidos nunca repiten.
export function pickDailyQuiz<T extends { id: string }>(
  quizzes: readonly T[],
  date: Date
): T | null {
  if (quizzes.length === 0) return null;
  const sorted = [...quizzes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted[dayNumber(dayKey(date)) % sorted.length] ?? null;
}

// ============================================
// Quiz del día (reto diario estilo Wordle)
// ============================================

/** Preguntas del reto diario. */
export const DAILY_QUESTION_COUNT = 5;

/**
 * Día editorial (America/Santiago) del primer reto: `dailyChallengeNumber`
 * devuelve 1 en esa fecha.
 */
export const DAILY_LAUNCH_DAY_KEY = '2026-11-05';

/** La clave de día `delta` días civiles después. Aritmética de calendario, sin huso. */
export function dayKeyAdd(key: string, delta: number): string {
  return new Date((dayNumber(key) + delta) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Un `Date` cuyo día civil en Chile es `key`. Mediodía con un -03:00 fijo: el
 * instante cae dentro del mismo día local con UTC-3 o UTC-4 (el reloj chileno
 * nunca sale de ese rango), así que sirve en invierno y en verano.
 */
export function dateFromDayKey(key: string): Date {
  return new Date(`${key}T12:00:00-03:00`);
}

/** Número del reto del día: 1 en el lanzamiento, +1 por día editorial. */
export function dailyChallengeNumber(date: Date): number {
  return Math.max(1, dayNumber(dayKey(date)) - dayNumber(DAILY_LAUNCH_DAY_KEY) + 1);
}

interface DailyTriviaCandidate {
  id: string;
  quiz_type: string;
  questions: readonly unknown[];
}

/**
 * El quiz del reto diario: un quiz de trivia del catálogo publicado, elegido
 * con la misma rotación determinista de `pickDailyQuiz`.
 *
 * Se prefieren los que tienen al menos `DAILY_QUESTION_COUNT` preguntas; si
 * ninguno llega (catálogo chico) se rota sobre cualquier trivia con preguntas
 * y el reto sale más corto antes que no salir.
 */
export function pickDailyTriviaQuiz<T extends DailyTriviaCandidate>(
  quizzes: readonly T[],
  date: Date
): T | null {
  const trivia = quizzes.filter((quiz) => quiz.quiz_type === 'trivia' && quiz.questions.length > 0);
  const withEnoughQuestions = trivia.filter(
    (quiz) => quiz.questions.length >= DAILY_QUESTION_COUNT
  );
  return pickDailyQuiz(withEnoughQuestions.length > 0 ? withEnoughQuestions : trivia, date);
}

// FNV-1a, el mismo hash diminuto de `src/lib/quiz/answer-key.ts`: se repite
// aquí porque ese módulo es server-only y este también se usa en el cliente.
function hashDaily(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Las `count` preguntas del reto dentro del quiz del día.
 *
 * Deterministas por `dayKey`: mismas para todos ese día y distintas de un día
 * a otro cuando el quiz sobra. El subconjunto elegido se devuelve en su orden
 * original porque `/api/quiz/reveal` exige revelar hacia adelante según el
 * índice de la pregunta en el quiz completo.
 */
export function pickDailyQuestions<T extends { id: string }>(
  questions: readonly T[],
  date: Date,
  count = DAILY_QUESTION_COUNT
): T[] {
  if (questions.length <= count) return [...questions];
  const key = dayKey(date);
  return questions
    .map((question, index) => ({
      index,
      question,
      rank: hashDaily(`${key}:${question.id}`),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, count)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.question);
}

const DAILY_PICK_COPY: Record<Locale, { eyebrow: string; title: string; body: string }> = {
  es: {
    eyebrow: 'Solo por hoy',
    title: 'El quiz de hoy',
    body: 'Una selección editorial que cambia cada día: la misma para todos y solo por 24 horas.',
  },
  en: {
    eyebrow: 'One day only',
    title: "Today's quiz",
    body: 'An editorial pick that changes every day — the same for everyone, gone tomorrow.',
  },
};

export function dailyPickCopy(locale: Locale, date: Date) {
  // Misma zona que dayKey: la fecha mostrada es la del día que rige la selección.
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: DAILY_TIME_ZONE,
  }).format(date);
  return { ...DAILY_PICK_COPY[locale], dateLabel };
}
