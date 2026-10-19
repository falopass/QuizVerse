import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAtomFeed } from '@/lib/seo/feed';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/seo/site';
import type { Quiz } from '@/types/quiz';

interface RecordedFeedQuery {
  eqs: Array<[string, unknown]>;
  orders: Array<[string, Record<string, unknown>]>;
  limit: number | null;
}

const recorded: RecordedFeedQuery = { eqs: [], orders: [], limit: null };
let queuedResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          recorded.eqs.push([column, value]);
          return builder;
        },
        order: (column: string, options: Record<string, unknown>) => {
          recorded.orders.push([column, options]);
          return builder;
        },
        limit: (n: number) => {
          recorded.limit = n;
          return Promise.resolve(queuedResult);
        },
      };
      return builder;
    },
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { GET } = await import('@/app/[locale]/feed.xml/route');

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'space-trivia',
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [],
    results: null,
    tags: [],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    created_at: '2026-05-20T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Well-formedness check without an XML dependency: every non-self-closing tag
 * must close in order. Catches unescaped text breaking the document.
 */
function expectWellFormed(xml: string) {
  const stack: string[] = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">/])*)(\/?)>/g;
  for (const match of xml.matchAll(tagPattern)) {
    const [, closing, name, , selfClosing] = match;
    if (closing) {
      expect(stack.pop(), `closing </${name}>`).toBe(name);
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  expect(stack, 'unclosed tags').toEqual([]);
  // Ningún & suelto: todo ampersand debe iniciar una entidad.
  expect(xml.match(/&(?!amp;|lt;|gt;|quot;|apos;)/)).toBeNull();
}

describe('buildAtomFeed', () => {
  it('emits a well-formed Atom document with self and alternate links', () => {
    const xml = buildAtomFeed({
      locale: 'es',
      quizzes: [makeQuiz()],
      updated: '2026-05-22T00:00:00.000Z',
    });

    expectWellFormed(xml);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain(
      `<link rel="self" type="application/atom+xml" href="${SITE_URL}/es/feed.xml"/>`
    );
    expect(xml).toContain(`<link rel="alternate" type="text/html" href="${SITE_URL}/es"/>`);
    expect(xml).toContain(`<id>${SITE_URL}/es/feed.xml</id>`);
  });

  it('emits one entry per quiz with absolute link, id, dates, summary and author', () => {
    const xml = buildAtomFeed({
      locale: 'en',
      quizzes: [makeQuiz({ slug: 'space-trivia' })],
      updated: '2026-05-22T00:00:00.000Z',
    });

    expect(xml.match(/<entry>/g)).toHaveLength(1);
    expect(xml).toContain(`<link href="${SITE_URL}/en/quiz/space-trivia"/>`);
    expect(xml).toContain(`<id>${SITE_URL}/en/quiz/space-trivia</id>`);
    expect(xml).toContain('<published>2026-05-21T00:00:00.000Z</published>');
    expect(xml).toContain('<updated>2026-05-22T00:00:00.000Z</updated>');
    expect(xml).toContain('<summary>A trivia quiz about space.</summary>');
    expect(xml).toContain('<author><name>QuizVerse</name></author>');
  });

  it('caps nothing itself but stays valid with 30 entries (route slices at 30)', () => {
    const quizzes = Array.from({ length: 30 }, (_, i) =>
      makeQuiz({ id: `q${i}`, slug: `quiz-${i}`, title: `Quiz ${i}` })
    );
    const xml = buildAtomFeed({ locale: 'en', quizzes, updated: '2026-05-22T00:00:00.000Z' });
    expectWellFormed(xml);
    expect(xml.match(/<entry>/g)).toHaveLength(30);
  });

  it('escapes &, <, > and quotes in titles, descriptions and slugs', () => {
    const xml = buildAtomFeed({
      locale: 'en',
      quizzes: [
        makeQuiz({
          slug: 'a&b<c>',
          title: 'Tom & Jerry <Best> "Quiz"',
          description: 'Rock > paper & "scissors" <always>',
        }),
      ],
      updated: '2026-05-22T00:00:00.000Z',
    });

    expectWellFormed(xml);
    expect(xml).toContain('Tom &amp; Jerry &lt;Best&gt; &quot;Quiz&quot;');
    expect(xml).toContain('a&amp;b&lt;c&gt;');
    expect(xml).not.toContain('<Best>');
  });
});

describe('buildMetadata — Atom alternate', () => {
  it('advertises the locale feed as application/atom+xml', () => {
    const metadata = buildMetadata({
      title: 'Trivia quizzes',
      description: 'Play free trivia.',
      path: '/en/quiz',
      locale: 'en',
    });

    expect(metadata.alternates?.types).toEqual({
      'application/atom+xml': `${SITE_URL}/en/feed.xml`,
    });
  });

  it('points the Spanish pages at the Spanish feed', () => {
    const metadata = buildMetadata({
      title: 'Quizzes',
      description: 'Juega.',
      path: '/es/quiz',
      locale: 'es',
    });

    expect(metadata.alternates?.types).toEqual({
      'application/atom+xml': `${SITE_URL}/es/feed.xml`,
    });
  });
});

describe('GET /[locale]/feed.xml', () => {
  beforeEach(() => {
    recorded.eqs = [];
    recorded.orders = [];
    recorded.limit = null;
    queuedResult = { data: [], error: null };
  });

  function feedRow(overrides: Record<string, unknown> = {}) {
    return {
      slug: 'space-trivia',
      title: 'Space Trivia',
      description: 'A quiz.',
      published_at: '2026-10-18T00:00:00.000Z',
      updated_at: '2026-10-18T00:00:00.000Z',
      created_at: '2026-10-18T00:00:00.000Z',
      ...overrides,
    };
  }

  function get(locale: string) {
    return GET(new Request(`https://quizverse.org/${locale}/feed.xml`), {
      params: Promise.resolve({ locale }),
    });
  }

  it('asks the DB for the 30 newest published quizzes of the locale', async () => {
    queuedResult = { data: [feedRow()], error: null };
    const res = await get('es');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/atom+xml');
    expect(recorded.eqs).toEqual([
      ['status', 'published'],
      ['language', 'es'],
    ]);
    expect(recorded.orders[0]).toEqual([
      'published_at',
      expect.objectContaining({ ascending: false }),
    ]);
    expect(recorded.limit).toBe(30);
  });

  it('returns a retryable 503 instead of stale entries when the DB read fails', async () => {
    queuedResult = { data: null, error: { message: 'db down' } };
    const res = await get('en');

    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('retry-after')).toBe('300');
  });

  it('derives the feed timestamp from the newest update across all entries', async () => {
    queuedResult = {
      data: [
        feedRow({ slug: 'new', published_at: '2026-10-19T00:00:00.000Z', updated_at: null }),
        feedRow({ slug: 'edited', updated_at: '2026-10-19T12:00:00.000Z' }),
      ],
      error: null,
    };
    const res = await get('en');
    const xml = await res.text();

    // La entrada "edited" se modificó después de publicar "new": el feed debe
    // anunciar la fecha más reciente de cualquier entrada, no la del último alta.
    expect(xml).toContain('<updated>2026-10-19T12:00:00.000Z</updated>');
  });

  it('rejects unknown locales', async () => {
    await expect(get('fr')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
