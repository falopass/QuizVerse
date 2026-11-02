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
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Último cambio real de contenido de un quiz: `content_updated_at` cuando la
 * fila lo trae; si no, la edición posterior a la publicación; si no,
 * `published_at`. Sin fechas válidas devuelve `undefined` para que el sitemap
 * omita el `<lastmod>`.
 *
 * `updated_at` solo cuenta como edición si la fila cambió después de crearse.
 * El import masivo inserta con el mismo `now()` de la transacción en
 * `created_at` y `updated_at`, así que un `updated_at` igual a `created_at` es
 * la fecha de inserción, no un cambio de contenido; esas URLs se quedan con su
 * `published_at` real. Un lote de ediciones auténticas sí tiene `created_at`
 * anterior y conserva su fecha.
 */
export function quizLastModified(quiz: QuizDateFields): string | undefined {
  if (isParsable(quiz.content_updated_at)) return quiz.content_updated_at;

  const published = isParsable(quiz.published_at) ? quiz.published_at : undefined;
  const updated = isParsable(quiz.updated_at) ? quiz.updated_at : undefined;
  const created = isParsable(quiz.created_at) ? quiz.created_at : undefined;

  const editedAfterInsert =
    updated && (!created || new Date(updated).getTime() > new Date(created).getTime());
  const contentDate = editedAfterInsert ? updated : undefined;

  if (published && contentDate) return newestIso([published, contentDate]);
  return published ?? contentDate ?? updated;
}
