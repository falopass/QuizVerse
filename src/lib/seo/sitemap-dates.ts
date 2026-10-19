/**
 * Devuelve la fecha más reciente de la lista, en su forma original.
 * Ignora `null`, `undefined`, `''` y strings que `Date` no parsea.
 */
export function newestIso(dates: Array<string | null | undefined>): string | undefined {
  let best: number | undefined;
  let bestIso: string | undefined;

  for (const value of dates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    if (best === undefined || time > best) {
      best = time;
      bestIso = value;
    }
  }

  return bestIso;
}
