/**
 * Estado local del reto diario (sin cuenta): última partida, racha de días
 * consecutivos, texto compartible en emojis y el instante del próximo reto.
 *
 * Funciones puras: el storage entra por parámetro para testearlas sin
 * navegador, mismo patrón que `src/lib/history/recent-quizzes.ts`. El día de
 * la racha es el editorial de Chile (`dayKey`), como el pick.
 */

import { dayKey, dayKeyAdd } from '@/lib/content/daily-pick';
import type { Locale } from '@/lib/i18n/dictionaries';

export const DAILY_STORAGE_KEY = 'quizverse:daily-result';

/** Resultado del último reto jugado en este dispositivo. */
export interface DailyRecord {
  /** Clave del día editorial (America/Santiago) que se jugó. */
  dayKey: string;
  score: number;
  total: number;
  /** Un emoji por pregunta, en orden: true = 🟩, false = 🟥. */
  marks: boolean[];
  seconds: number;
  /** Racha de días consecutivos al terminar esa partida. */
  streak: number;
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

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDailyRecord(value: unknown): value is DailyRecord {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.dayKey === 'string' &&
    DAY_KEY_PATTERN.test(entry.dayKey) &&
    typeof entry.score === 'number' &&
    typeof entry.total === 'number' &&
    Array.isArray(entry.marks) &&
    entry.marks.every((mark) => typeof mark === 'boolean') &&
    entry.marks.length === entry.total &&
    typeof entry.seconds === 'number' &&
    typeof entry.streak === 'number'
  );
}

/** El último resultado guardado, o null si no hay o está corrupto. */
export function readDailyResult(
  storage: StorageLike | null = defaultStorage()
): DailyRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDailyRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el resultado del día y devuelve el registro con la racha ya calculada.
 *
 * La racha cuenta días editoriales consecutivos jugados: si el último registro
 * es de ayer suma uno; si es de hoy (reintento) se conserva; con cualquier
 * otro hueco vuelve a 1. Como trabaja sobre claves de calendario, el cambio de
 * horario chileno (días de 23/25 h) no rompe la cuenta.
 */
export function recordDailyResult(
  result: Omit<DailyRecord, 'streak'>,
  storage: StorageLike | null = defaultStorage()
): DailyRecord {
  const previous = readDailyResult(storage);
  const streak =
    previous?.dayKey === result.dayKey
      ? previous.streak
      : previous && dayKeyAdd(previous.dayKey, 1) === result.dayKey
        ? previous.streak + 1
        : 1;
  const record: DailyRecord = { ...result, streak };
  try {
    // Safari privado lanza al escribir: se pierde la racha, no la partida.
    storage?.setItem(DAILY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* noop */
  }
  return record;
}

/**
 * Racha vigente para mostrar antes de jugar: vive si el último reto fue hoy o
 * ayer (todavía se puede alargar hoy); con un día de por medio ya expiró.
 */
export function currentDailyStreak(record: DailyRecord | null, todayKey: string): number {
  if (!record) return 0;
  return record.dayKey === todayKey || dayKeyAdd(record.dayKey, 1) === todayKey ? record.streak : 0;
}

/**
 * Instante en que empieza el próximo reto: la medianoche de America/Santiago.
 *
 * Se busca binariamente el primer instante cuyo `dayKey` cambia: el día del
 * cambio de horario no tiene medianoche local (el reloj salta 00:00 → 01:00),
 * así que una fórmula de offset fija falla ese día y esto no.
 */
export function nextDailyReset(now = new Date()): Date {
  const target = dayKey(now);
  let lo = now.getTime();
  let hi = lo + 48 * 60 * 60 * 1000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayKey(new Date(mid)) === target) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/** `48` → "0:48", `605` → "10:05". */
export function formatDailySeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export interface DailyShareInput {
  challengeNumber: number;
  score: number;
  total: number;
  marks: readonly boolean[];
  seconds: number;
  streak: number;
  locale: Locale;
}

/**
 * El texto que viaja por WhatsApp/X: marcador, grilla de emojis, tiempo y
 * racha. Nunca lleva preguntas ni respuestas — solo aciertos y fallos.
 */
export function buildDailyShareText(input: DailyShareInput): string {
  const grid = input.marks.map((mark) => (mark ? '🟩' : '🟥')).join('');
  const streakLabel = input.locale === 'es' ? 'racha' : 'streak';
  return [
    `QuizVerse #${input.challengeNumber} 🧠 ${input.score}/${input.total}`,
    `${grid}  ⏱ ${formatDailySeconds(input.seconds)}  🔥 ${streakLabel} ${input.streak}`,
    `quizverse.org/${input.locale}/daily`,
  ].join('\n');
}
