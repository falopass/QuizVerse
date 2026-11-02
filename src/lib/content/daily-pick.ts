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
