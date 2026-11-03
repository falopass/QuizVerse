/**
 * `sb-<project>-auth-token` y sus trozos `.0`, `.1`, … son la única señal de
 * sesión de Supabase. `-code-verifier` (PKCE en curso) no cuenta: todavía no
 * hay sesión.
 *
 * La usan el proxy (refresh) y el provider en el navegador (carga diferida).
 */
const SESSION_COOKIE_RE = /^sb-.+-auth-token(\.\d+)?$/;

export function hasSessionCookie(cookies: ReadonlyArray<{ name: string }>): boolean {
  return cookies.some(({ name }) => SESSION_COOKIE_RE.test(name));
}
