/**
 * Contrato de las rutas públicas de lectura.
 *
 * Un solo sitio decide qué query params son válidos y cómo se responde un
 * error, para que `/api/categories`, `/api/quizzes`, `/api/stats` y
 * `/api/leaderboard` no diverjan en formato.
 */

import { z } from 'zod';

export const LocaleSchema = z.enum(['en', 'es']);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const QuizQuerySchema = PaginationSchema.extend({
  locale: LocaleSchema.optional(),
  /** Slug de categoría (`movies-tv`) o hub de tipo (`trivia`, `personality`). */
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
  /** Búsqueda por título. 2 caracteres mínimo para no golpear la base por nada. */
  q: z.string().trim().min(2).max(60).optional(),
});

export type QuizQuery = z.infer<typeof QuizQuerySchema>;
export type Pagination = z.infer<typeof PaginationSchema>;

export type QueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> };

/** Parsea `URLSearchParams` contra un esquema; no lanza, devuelve el error. */
export function parseQuery<T>(schema: z.ZodType<T>, searchParams: URLSearchParams): QueryResult<T> {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  return { ok: true, data: parsed.data };
}

/** Cabeceras comunes de las lecturas públicas. */
export const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
} as const;

export function jsonOk(payload: unknown, init?: ResponseInit): Response {
  return Response.json(payload, {
    ...init,
    headers: { ...PUBLIC_CACHE_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function jsonError(status: number, error: string, details?: unknown): Response {
  return Response.json(
    { error, ...(details ? { details } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}
