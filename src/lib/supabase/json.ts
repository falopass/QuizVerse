/**
 * Boundary helpers for the JSONB columns.
 *
 * Supabase types every `jsonb` column as `Json`, which a plain interface is not
 * assignable to (no index signature). Instead of scattering `as unknown as`
 * casts across the codebase, values cross the boundary here.
 */

import type { Json } from '@/types/database';

/** Narrows an application value into a `jsonb` column value. */
export function toJson(value: unknown): Json {
  return value as Json;
}

/** Reads a `jsonb` column back as a typed value. Callers validate the shape. */
export function fromJson<T>(value: Json | null | undefined, fallback: T): T {
  return (value ?? fallback) as unknown as T;
}
