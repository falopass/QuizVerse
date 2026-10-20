/**
 * Test de regresión: todas las páginas editoriales indexables deben estar en el
 * sitemap, en ambos idiomas y con su alternate `xhtml:link`. `/indice` quedó
 * fuera una vez (FIX-25); este test exige la lista completa para que no vuelva
 * a quedarse corta.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

const quizRows = [
  {
    slug: 'es-quiz',
    language: 'es',
    published_at: '2026-10-01T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
];

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => ({ data: quizRows, error: null }),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: () => null,
}));

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GET } from '@/app/api/sitemap/route';

// El conjunto esperado se deriva del filesystem, no de una lista fija: así una
// página editorial nueva omitida del sitemap hace fallar este test aunque
// nadie la añada aquí (cubre el blind spot de la lista hardcodeada).
const LOCALE_DIR = join(__dirname, '../src/app/[locale]');
const NOINDEX = /noindex|index:\s*false/;

function expectedEditorialPaths(): string[] {
  const paths = new Set<string>(['']);
  // Recursivo para no perder páginas editoriales anidadas (p. ej. `foo/bar`).
  const entries = readdirSync(LOCALE_DIR, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name !== 'page.tsx') continue;
    const rel = entry.parentPath.slice(LOCALE_DIR.length);
    if (rel.includes('[')) continue;
    if (NOINDEX.test(readFileSync(join(entry.parentPath, 'page.tsx'), 'utf8'))) continue;
    paths.add(rel);
  }
  return [...paths].sort();
}

const EDITORIAL_PATHS = expectedEditorialPaths();

function urlBlock(xml: string, loc: string): string | undefined {
  const match = xml.match(
    new RegExp(`<url>(?:(?!</url>).)*?<loc>${loc}</loc>(?:(?!</url>).)*?</url>`, 's')
  );
  return match?.[0];
}

let xml: string;
let response: Awaited<ReturnType<typeof GET>>;

describe('GET /api/sitemap — páginas editoriales', () => {
  beforeAll(async () => {
    response = await GET();
    xml = await response.text();
  });

  it('responde 200 con content-type XML', () => {
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/xml');
  });

  it('incluye todas las páginas editoriales en es y en', () => {
    for (const locale of ['es', 'en']) {
      for (const path of EDITORIAL_PATHS) {
        expect(xml).toContain(`<loc>https://quizverse.org/${locale}${path}</loc>`);
      }
    }
  });

  it('/indice declara su alternate xhtml:link en ambos idiomas', () => {
    for (const locale of ['es', 'en']) {
      const other = locale === 'es' ? 'en' : 'es';
      const block = urlBlock(xml, `https://quizverse.org/${locale}/indice`);
      expect(block).toBeDefined();
      expect(block).toContain('xhtml:link');
      expect(block).toContain(`hreflang="${other}" href="https://quizverse.org/${other}/indice"`);
    }
  });
});
