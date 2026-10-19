import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const llmsTxt = readFileSync(path.resolve(__dirname, '../public/llms.txt'), 'utf8');

describe('public/llms.txt', () => {
  it('starts with an H1 title', () => {
    expect(llmsTxt.startsWith('# ')).toBe(true);
  });

  it('references the site domain', () => {
    expect(llmsTxt).toContain('quizverse.org');
  });

  it.each(['/sitemap.xml', '/en/quiz', '/es/quiz'])('mentions %s', (route) => {
    expect(llmsTxt).toContain(route);
  });

  it('has no placeholder markers', () => {
    expect(llmsTxt).not.toMatch(/\bTODO\b|\bFIXME\b|\bXXX\b|PLACEHOLDER/);
  });
});
