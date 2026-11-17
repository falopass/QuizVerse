/**
 * Segundos → `m:ss` para el cronómetro del juego. Los minutos no se acotan:
 * una partida de 90 minutos se lee `90:00`, no `1:30:00`.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
