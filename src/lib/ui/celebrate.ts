/**
 * Confetti diferido: `canvas-confetti` (~20 KB) no viaja en el chunk de la
 * pantalla — se importa solo cuando hay algo que celebrar. Sin `window`
 * (SSR) o con `prefers-reduced-motion: reduce` devuelve un noop y el módulo
 * nunca se carga.
 *
 * Devuelve la función de cancelación: si se llama antes de que el import
 * resuelva, la ráfaga no llega a lanzarse.
 */
export interface CelebrateOptions {
  /** Duración total de la lluvia; cada tick lanza menos partículas. */
  durationMs?: number;
  /** Cadencia entre ráfagas. */
  intervalMs?: number;
  /** Partículas del primer tick; las siguientes decaen con el tiempo restante. */
  particlesPerTick?: number;
}

const CONFETTI_DEFAULTS = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999 };

const noop = () => {};

export function celebrate({
  durationMs = 3000,
  intervalMs = 250,
  particlesPerTick = 50,
}: CelebrateOptions = {}): () => void {
  if (typeof window === 'undefined') return noop;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return noop;

  let cancelled = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  void import('canvas-confetti').then(({ default: confetti }) => {
    if (cancelled) return;
    // El plazo corre desde que el módulo carga: una descarga lenta no debe
    // comerse la celebración (la de personality ya es corta de por sí).
    const end = Date.now() + durationMs;
    interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        if (interval !== undefined) clearInterval(interval);
        return;
      }
      void confetti({
        ...CONFETTI_DEFAULTS,
        particleCount: Math.max(1, Math.round(particlesPerTick * (timeLeft / durationMs))),
        origin: { x: Math.random(), y: Math.random() * 0.4 },
      });
    }, intervalMs);
  });

  return () => {
    cancelled = true;
    if (interval !== undefined) clearInterval(interval);
  };
}
