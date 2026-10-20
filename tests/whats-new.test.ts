/**
 * Contrato de /{locale}/novedades:
 * - `partitionByRecency` parte por fecha efectiva (published_at ?? created_at),
 *   con límite inclusivo y salida descendente.
 * - `getWhatsNew` pide columnas explícitas (nunca questions ni correct_answers)
 *   y cae al catálogo de lanzamiento si Supabase falla.
 * - `generateMetadata` emite canonical propio, hreflang en/es + x-default y
 *   nunca noindex.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  selectCols: [] as string[],
  filters: [] as string[],
  result: { data: [] as unknown[], error: null as { message: string } | null },
  undated: { data: [] as unknown[], error: null as { message: string } | null },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      let onlyUndated = false;
      const query = {
        select: (cols: string) => {
          db.selectCols.push(cols);
          return query;
        },
        eq: (col: string, val: string) => {
          db.filters.push(`${col}=${val}`);
          return query;
        },
        is: (col: string, val: unknown) => {
          if (col === 'published_at' && val === null) onlyUndated = true;
          return query;
        },
        not: () => query,
        order: () => query,
        limit: async () => (onlyUndated ? db.undated : db.result),
      };
      return query;
    },
  }),
}));

import { getWhatsNew, partitionByRecency } from '@/lib/data/whats-new';
import { generateMetadata } from '@/app/[locale]/novedades/page';
import { GET } from '@/app/api/sitemap/route';
import { SITE_URL } from '@/lib/seo/site';

const NOW = new Date('2026-10-19T12:00:00.000Z');

const item = (slug: string, published_at: string | null, created_at: string) => ({
  slug,
  published_at,
  created_at,
});

beforeEach(() => {
  db.selectCols.length = 0;
  db.filters.length = 0;
  db.result = { data: [], error: null };
  db.undated = { data: [], error: null };
});

describe('partitionByRecency', () => {
  it('incluye en fresh la fecha límite exacta', () => {
    const { fresh, older } = partitionByRecency(
      [
        item('boundary', '2026-10-12T12:00:00.000Z', '2026-10-01T00:00:00.000Z'),
        item('inside', '2026-10-13T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
        item('outside', '2026-10-12T11:59:59.000Z', '2026-10-01T00:00:00.000Z'),
      ],
      NOW
    );

    expect(fresh.map((i) => i.slug)).toEqual(['inside', 'boundary']);
    expect(older.map((i) => i.slug)).toEqual(['outside']);
  });

  it('usa created_at cuando published_at es nulo', () => {
    const { fresh, older } = partitionByRecency(
      [
        item('no-published', null, '2026-10-18T00:00:00.000Z'),
        item('old-no-published', null, '2026-09-01T00:00:00.000Z'),
      ],
      NOW
    );

    expect(fresh.map((i) => i.slug)).toEqual(['no-published']);
    expect(older.map((i) => i.slug)).toEqual(['old-no-published']);
  });

  it('devuelve ambas particiones en orden descendente', () => {
    const { fresh, older } = partitionByRecency(
      [
        item('c', '2026-10-14T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
        item('a', '2026-10-18T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
        item('e', '2026-09-10T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
        item('b', '2026-10-16T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
        item('d', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ],
      NOW
    );

    expect(fresh.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
    expect(older.map((i) => i.slug)).toEqual(['e', 'd']);
  });
});

describe('getWhatsNew', () => {
  it('consulta columnas explícitas y filtra por estado e idioma', async () => {
    await getWhatsNew(30, 'en');

    const cols = db.selectCols.at(-1) ?? '';
    expect(cols).not.toContain('*');
    expect(cols).not.toContain('questions');
    expect(cols).not.toContain('correct_answers');
    expect(cols).toContain('published_at');
    expect(cols).toContain('created_at');
    expect(db.filters).toContain('status=published');
    expect(db.filters).toContain('language=en');
  });

  it('fusiona la rama sin published_at para que los quizzes sin fecha no desaparezcan', async () => {
    // Regresión: un LIMIT sobre published_at DESC enterraba a los quizzes
    // publicados con fecha nula (createQuiz los inserta así).
    const dated = (slug: string, published_at: string, created_at: string) => ({
      slug,
      title: slug,
      description: null,
      language: 'en',
      quiz_type: 'trivia',
      estimated_minutes: 3,
      published_at,
      created_at,
      category: null,
    });
    db.result = {
      data: Array.from({ length: 30 }, (_, i) =>
        dated(
          `dated-${i}`,
          `2026-10-${String(19 - (i % 18)).padStart(2, '0')}T00:00:00Z`,
          '2026-10-01T00:00:00Z'
        )
      ),
      error: null,
    };
    db.undated = {
      data: [
        {
          slug: 'undated-new',
          title: 'Undated New',
          description: null,
          language: 'en',
          quiz_type: 'trivia',
          estimated_minutes: 3,
          published_at: null,
          created_at: '2026-10-19T12:00:00Z',
          category: null,
        },
      ],
      error: null,
    };

    const quizzes = await getWhatsNew(30, 'en');

    expect(quizzes[0]?.slug).toBe('undated-new');
    expect(quizzes).toHaveLength(30);
  });

  it('cae al catálogo local del idioma si Supabase falla', async () => {
    db.result = { data: [], error: { message: 'connection failed' } };

    const quizzes = await getWhatsNew(5, 'es');

    expect(quizzes.length).toBeGreaterThan(0);
    expect(quizzes.length).toBeLessThanOrEqual(5);
    expect(quizzes.every((quiz) => quiz.language === 'es')).toBe(true);
    const times = quizzes.map((quiz) => new Date(quiz.published_at ?? quiz.created_at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe('generateMetadata de /novedades', () => {
  it.each(['en', 'es'] as const)(
    'emite canonical propio, hreflang mutuo + x-default y sin noindex (%s)',
    async (locale) => {
      const other = locale === 'es' ? 'en' : 'es';
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

      expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/${locale}/novedades`);
      expect(metadata.alternates?.languages).toEqual({
        [locale]: `${SITE_URL}/${locale}/novedades`,
        [other]: `${SITE_URL}/${other}/novedades`,
        'x-default': `${SITE_URL}/en/novedades`,
      });
      expect(metadata.robots).toMatchObject({ index: true });
    }
  );
});

describe('sitemap — /novedades', () => {
  it('declara /novedades en ambos idiomas con xhtml:link mutuos', async () => {
    // Un `data: []` haría responder 503 a la ruta (REV-16): hace falta al
    // menos una fila publicada para que el sitemap salga.
    db.result = {
      data: [
        {
          slug: 'quiz-uno',
          language: 'es',
          published_at: '2026-10-01T00:00:00Z',
          updated_at: null,
          quiz_type: 'trivia',
          category_id: 'gaming',
          category: { slug: 'gaming' },
        },
      ],
      error: null,
    };
    const xml = await (await GET()).text();

    const block = (loc: string) =>
      xml.match(
        new RegExp(`<url>(?:(?!</url>).)*?<loc>${loc}</loc>(?:(?!</url>).)*?</url>`, 's')
      )?.[0];

    for (const locale of ['en', 'es'] as const) {
      const other = locale === 'es' ? 'en' : 'es';
      const entry = block(`${SITE_URL}/${locale}/novedades`);
      expect(entry).toBeDefined();
      expect(entry).toContain('xhtml:link');
      expect(entry).toContain(`hreflang="${other}" href="${SITE_URL}/${other}/novedades"`);
      expect(entry).toContain('hreflang="x-default"');
    }
  });
});
