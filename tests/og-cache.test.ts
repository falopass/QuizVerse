import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG_CACHE_HEADERS, OG_MISS_CACHE_HEADERS } from '@/lib/seo/og-cache';

const QUIZ_OG = join(process.cwd(), 'src/app/[locale]/quiz/[slug]/opengraph-image.tsx');
const CATEGORY_OG = join(process.cwd(), 'src/app/[locale]/category/[slug]/opengraph-image.tsx');
const EXPLORE_OG = join(process.cwd(), 'src/app/[locale]/quiz/opengraph-image.tsx');
const OG_RESULT_ROUTE = join(process.cwd(), 'src/app/api/og/result/[locale]/[slug]/route.tsx');

const FALLBACK_FILES = [
  ['home', join(process.cwd(), 'src/app/[locale]/opengraph-image.tsx')],
  ['explore', EXPLORE_OG],
  ['quiz', QUIZ_OG],
  ['category', CATEGORY_OG],
  ['indice', join(process.cwd(), 'src/app/[locale]/indice/opengraph-image.tsx')],
  ['api/og/result', OG_RESULT_ROUTE],
];

describe('OG_CACHE_HEADERS', () => {
  it('incluye max-age=3600 y stale-while-revalidate', () => {
    expect(OG_CACHE_HEADERS['Cache-Control']).toContain('max-age=3600');
    expect(OG_CACHE_HEADERS['Cache-Control']).toContain('stale-while-revalidate');
  });
});

describe('OG_MISS_CACHE_HEADERS', () => {
  it('usa un s-maxage corto para misses', () => {
    expect(OG_MISS_CACHE_HEADERS['Cache-Control']).toContain('s-maxage=300');
    expect(OG_MISS_CACHE_HEADERS['Cache-Control']).toContain('stale-while-revalidate');
  });
});

describe.each(FALLBACK_FILES)('fallback OG de %s', (_name, file) => {
  it('sirve la tarjeta de respaldo con OG_MISS_CACHE_HEADERS', () => {
    const source = readFileSync(file, 'utf8');
    expect(source).toContain('OG_MISS_CACHE_HEADERS');
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
