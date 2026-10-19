import { z } from 'zod';

// Open redirect: una sola regla para ?redirect=/next, reemplaza las copias en login, registro y callback.
const internalPathSchema = z
  .string()
  .startsWith('/')
  .refine(
    (path) => !path.startsWith('//') && !path.startsWith('/\\') && !/[\x00-\x1f\x7f]/.test(path)
  );

export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  const parsed = internalPathSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
