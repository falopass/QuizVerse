import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('robots.txt', () => {
  it('permite las imágenes OG bajo /api/og/ y bloquea el resto de la API', () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(true);
    const rule = (rules as { allow?: string | string[]; disallow?: string | string[] }[])[0];
    expect(rule.allow).toEqual(['/', '/api/og/']);
    expect(rule.disallow).toEqual('/api/');
  });
});
