import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';

const FALLBACK = '/es';

describe('safeRedirectPath', () => {
  it.each(['/', '/es/quiz/x', '/es/settings'])('acepta la ruta interna %s', (path) => {
    expect(safeRedirectPath(path, FALLBACK)).toBe(path);
  });

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '',
    undefined,
    null,
    '/es/quiz/\nmalformed',
  ])('rechaza %s y devuelve el fallback', (value) => {
    expect(safeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
  });
});
