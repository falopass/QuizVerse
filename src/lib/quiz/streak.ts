/**
 * Racha vigente para mostrar.
 *
 * La base guarda `current_streak` tal como la calculó el trigger de la 018, y
 * ese valor solo se recalcula al insertar una partida: quien dejó de jugar hace
 * tres días conserva el número viejo hasta su próxima partida. Al leerlo hay que
 * descontar los días perdidos — si el último día jugado no es hoy ni ayer, la
 * racha vigente es 0. `longest_streak` (el máximo histórico) no se toca.
 *
 * Misma zona que el trigger: America/Santiago. Si cambia una, cambia la otra.
 */
const STREAK_TIME_ZONE = 'America/Santiago';

/** Día de hoy (YYYY-MM-DD) en la zona de la racha. */
export function todayInStreakZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STREAK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Días de racha que siguen vivos. Jugó hoy o ayer: la racha se mantiene (hoy
 * todavía puede estirarla). Cualquier hueco mayor: 0.
 */
export function liveStreak(
  currentStreak: number,
  lastPlayedOn: string | null,
  today: string = todayInStreakZone()
): number {
  if (!lastPlayedOn) return 0;
  if (lastPlayedOn >= today) return currentStreak;

  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return lastPlayedOn === yesterday.toISOString().slice(0, 10) ? currentStreak : 0;
}
