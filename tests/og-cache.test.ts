import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG_CACHE_HEADERS } from '@/lib/seo/og-cache';

const QUIZ_OG = join(process.cwd(), 'src/app/[locale]/quiz/[slug]/opengraph-image.tsx');
const CATEGORY_OG = join(process.cwd(), 'src/app/[locale]/category/[slug]/opengraph-image.tsx');

describe('OG_CACHE_HEADERS', () => {
  it('incluye max-age=3600 y stale-while-revalidate', () => {
    expect(OG_CACHE_HEADERS['Cache-Control']).toContain('max-age=3600');
    expect(OG_CACHE_HEADERS['Cache-Control']).toContain('stale-while-revalidate');
  });
});

describe.each([
  ['quiz', QUIZ_OG],
  ['category', CATEGORY_OG],
])('opengraph-image de %s', (_name, file) => {
  it('importa y usa OG_CACHE_HEADERS', () => {
    const source = readFileSync(file, 'utf8');
    expect(source).toContain('OG_CACHE_HEADERS');
  });
});
