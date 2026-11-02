import { describe, expect, it } from 'vitest';
import { hasSessionCookie } from '@/lib/supabase/session-cookie';

describe('hasSessionCookie', () => {
  it('detecta la cookie de sesión y sus trozos', () => {
    expect(hasSessionCookie([{ name: 'sb-quizverse-auth-token' }])).toBe(true);
    expect(hasSessionCookie([{ name: 'sb-quizverse-auth-token.0' }])).toBe(true);
    expect(hasSessionCookie([{ name: 'sb-quizverse-auth-token.12' }])).toBe(true);
  });

  it('ignora el code-verifier de PKCE y cookies ajenas', () => {
    expect(hasSessionCookie([{ name: 'sb-quizverse-auth-token-code-verifier' }])).toBe(false);
    expect(hasSessionCookie([{ name: 'sb-quizverse-auth-token-code-verifier.0' }])).toBe(false);
    expect(hasSessionCookie([{ name: 'theme' }, { name: 'qv_consent' }])).toBe(false);
    expect(hasSessionCookie([])).toBe(false);
  });
});
