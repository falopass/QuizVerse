import type { Locale } from '@/lib/i18n/dictionaries';

// La selección rota a medianoche UTC: el mismo quiz para todo el mundo durante
// el día, sin depender de la zona horaria del servidor.
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// FNV-1a de 32 bits sobre la clave del día: hash barato y determinista con
// suficiente dispersión para que días consecutivos caigan en índices distintos.
function hashDayKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pickDailyQuiz<T extends { id: string }>(
  quizzes: readonly T[],
  date: Date
): T | null {
  if (quizzes.length === 0) return null;
  return quizzes[hashDayKey(dayKey(date)) % quizzes.length] ?? null;
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
  // UTC como en dayKey: la fecha mostrada es la del día que rige la selección.
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  return { ...DAILY_PICK_COPY[locale], dateLabel };
}
