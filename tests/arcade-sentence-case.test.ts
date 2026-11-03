import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8');

describe('Arcade: sentence case', () => {
  it.each(['.arcade-button', '.arcade-hero-copy h1', '.arcade-detail-copy h1'])(
    '%s no fuerza mayúsculas en ninguna de sus reglas',
    (selector) => {
      const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) =>
        match[1].split(',').some((item) => item.trim() === selector)
      );

      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule[2]).not.toMatch(/text-transform:\s*uppercase/);
        expect(rule[2]).not.toMatch(/letter-spacing:\s*0\.\d*[1-9]/);
      }
    }
  );
});
