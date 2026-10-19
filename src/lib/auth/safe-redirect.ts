// Open redirect: una sola regla para ?redirect=/next, reemplaza las copias en login, registro y callback.
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    return fallback;
  }
  return value;
}
