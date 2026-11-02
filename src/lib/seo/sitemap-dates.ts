function isParsable(value: string | null | undefined): value is string {
  return typeof value === 'string' && value !== '' && !Number.isNaN(new Date(value).getTime());
}

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

/** Campos de fecha que el sitemap conoce de cada quiz. */
export interface QuizDateFields {
  /**
   * Cambio de contenido explícito. Hoy el esquema versionado no tiene la
   * columna: la migración 011 redefine `updated_at` para que solo cambie
   * cuando cambia el contenido. Se acepta igual para cuando exista.
   */
  content_updated_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

/**
 * Un `updated_at` repetido en demasiadas filas es la firma de un import
 * masivo o de un script por lotes: se escribió para todas a la vez y no dice
 * cuándo cambió el contenido de cada ficha. Google desconfía de un `lastmod`
 * uniforme, así que esas URLs usan su fecha de publicación.
 *
 * Los lotes pequeños (decenas de fichas) sí son ediciones de contenido reales
 * y se conservan; por eso el umbral es alto.
 */
export const MASS_UPDATE_MIN_ROWS = 50;

/** Timestamps de `updated_at` que comparten al menos `minRows` filas. */
export function massUpdatedAt(
  dates: Array<string | null | undefined>,
  minRows = MASS_UPDATE_MIN_ROWS
): Set<string> {
  const counts = new Map<string, number>();
  for (const value of dates) {
    if (!isParsable(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count >= minRows).map(([value]) => value));
}

/**
 * Último cambio real de contenido de un quiz: `content_updated_at` cuando la
 * fila lo trae; si no, la edición posterior a la publicación (`updated_at` de
 * ficha, nunca uno de lote); si no, `published_at`. Sin fechas válidas
 * devuelve `undefined` para que el sitemap omita el `<lastmod>`.
 */
export function quizLastModified(
  quiz: QuizDateFields,
  massTimestamps: ReadonlySet<string> = new Set()
): string | undefined {
  if (isParsable(quiz.content_updated_at)) return quiz.content_updated_at;

  const published = isParsable(quiz.published_at) ? quiz.published_at : undefined;
  const updated = isParsable(quiz.updated_at) ? quiz.updated_at : undefined;
  const perQuizUpdated = updated && !massTimestamps.has(updated) ? updated : undefined;

  if (published && perQuizUpdated) return newestIso([published, perQuizUpdated]);
  return published ?? perQuizUpdated;
}
