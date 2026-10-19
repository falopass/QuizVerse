import { describe, expect, it } from 'vitest';
import {
  buildMetadata,
  clampDescription,
  generateCategoryMetadata,
  generateProfileMetadata,
  localizedPath,
} from '@/lib/seo/metadata';
import { generateSitemapXml } from '@/lib/seo/sitemap';
import {
  buildGraph,
  breadcrumbNode,
  categoryPath,
  isoDuration,
  itemListNode,
  quizNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';
import { SITE_URL } from '@/lib/seo/site';
import type { Quiz } from '@/types/quiz';

const quiz: Quiz = {
  id: 'q1',
  slug: 'space-trivia',
  title: 'Space Trivia',
  description: 'A description',
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'medium',
  language: 'en',
  questions: [
    { id: '1', question: 'Q1', options: [{ id: 'a', text: 'A' }] },
    { id: '2', question: 'Q2', options: [{ id: 'b', text: 'B' }] },
  ],
  results: null,
  tags: ['space', 'nasa'],
  estimated_minutes: 4,
  plays_count: 120,
  shares_count: 0,
  avg_score: null,
  likes_count: 0,
  status: 'published',
  is_featured: false,
  is_ai_generated: false,
  published_at: '2026-05-21T02:58:55.027Z',
  created_at: '2026-05-21T02:58:55.027Z',
};

describe('clampDescription', () => {
  it('keeps short copy untouched', () => {
    expect(clampDescription('Sharp rounds with clean pacing.')).toBe(
      'Sharp rounds with clean pacing.'
    );
  });

  it('collapses whitespace and strips markdown noise', () => {
    expect(clampDescription('## Title\n\n**bold**   text')).toBe('Title bold text');
  });

  it('clamps long copy to the SERP limit on a word boundary', () => {
    const long = `${'palabra '.repeat(40)}final`;
    const result = clampDescription(long);
    expect(result.length).toBeLessThanOrEqual(158);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('…final');
  });

  it('handles null and empty input', () => {
    expect(clampDescription(null)).toBe('');
    expect(clampDescription('   ')).toBe('');
  });
});

describe('buildMetadata', () => {
  it('derives canonical, og:url and hreflang from one path', () => {
    const metadata = buildMetadata({
      title: 'Trivia quizzes',
      description: 'Play free trivia.',
      path: '/en/quiz',
      alternatePath: '/es/quiz',
      locale: 'en',
    });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/en/quiz`);
    expect(metadata.openGraph?.url).toBe(`${SITE_URL}/en/quiz`);
    expect(metadata.alternates?.languages).toEqual({
      en: `${SITE_URL}/en/quiz`,
      es: `${SITE_URL}/es/quiz`,
      'x-default': `${SITE_URL}/en/quiz`,
    });
  });

  it('never invents a translation when no counterpart exists', () => {
    const metadata = buildMetadata({
      title: 'Space Trivia',
      description: 'Play it.',
      path: '/en/quiz/space-trivia',
      locale: 'en',
    });

    // Regression: this used to emit hreflang="es" pointing at the Spanish home.
    expect(metadata.alternates?.languages).toEqual({
      en: `${SITE_URL}/en/quiz/space-trivia`,
      'x-default': `${SITE_URL}/en/quiz/space-trivia`,
    });
  });

  it('points x-default at the English page when both locales exist', () => {
    const metadata = buildMetadata({
      title: 'Personalidad',
      description: 'Tests.',
      path: '/es/category/personality',
      alternatePath: '/en/category/personality',
      locale: 'es',
    });

    expect(metadata.alternates?.languages).toMatchObject({
      'x-default': `${SITE_URL}/en/category/personality`,
    });
  });

  it('emits a self canonical and noindex for private views', () => {
    const metadata = buildMetadata({
      title: 'Playing Space Trivia',
      description: 'Play it.',
      path: '/en/quiz/space-trivia/play',
      locale: 'en',
      noindex: true,
    });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/en/quiz/space-trivia/play`);
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it('always provides a description', () => {
    const metadata = buildMetadata({
      title: 'Sin descripción',
      description: null,
      path: '/es/about',
      locale: 'es',
    });

    expect(typeof metadata.description).toBe('string');
    expect((metadata.description as string).length).toBeGreaterThan(40);
  });
});

describe('generateSitemapXml', () => {
  it('escapes ampersands and keeps valid lastmod values', () => {
    const xml = generateSitemapXml(
      [{ url: '/en/quiz/a&b', lastModified: '2026-05-21T02:58:55.027Z' }],
      SITE_URL
    );

    expect(xml).toContain('<loc>https://quizverse.org/en/quiz/a&amp;b</loc>');
    expect(xml).toContain('<lastmod>2026-05-21T02:58:55.027Z</lastmod>');
  });

  it('drops lastmod values Google cannot parse', () => {
    const xml = generateSitemapXml([{ url: '/en', lastModified: 'not-a-date' }], SITE_URL);
    expect(xml).not.toContain('<lastmod>');
  });
});

describe('structured data', () => {
  it('describes a quiz with real, non-invented properties', () => {
    const node = quizNode({
      quiz,
      locale: 'en',
      category: null,
      description: 'A description',
      imageUrl: 'https://quizverse.org/og/x.png',
    });

    expect(node['@type']).toBe('Quiz');
    expect(node.numberOfQuestions).toBe(2);
    expect(node.timeRequired).toBe('PT4M');
    expect(node.inLanguage).toBe('en');
    // No aggregateRating: there are no real ratings to publish.
    expect(node).not.toHaveProperty('aggregateRating');
    expect(node.interactionStatistic).toMatchObject({ userInteractionCount: 120 });
  });

  it('omits optional nodes instead of emitting empty ones', () => {
    expect(breadcrumbNode([{ name: 'Home', path: '/en' }])).toBeNull();
    const graph = buildGraph([null, undefined]);
    expect(graph['@graph']).toHaveLength(0);
  });

  it('formats durations as ISO 8601', () => {
    expect(isoDuration(4)).toBe('PT4M');
    expect(isoDuration(0)).toBe('PT1M');
  });
});

describe('generateSitemapXml — alternates bilingües', () => {
  it('emite xhtml:link con el namespace declarado', () => {
    const xml = generateSitemapXml(
      [
        {
          url: '/en/quiz/space-trivia',
          alternates: [
            { hreflang: 'en', href: '/en/quiz/space-trivia' },
            { hreflang: 'es', href: '/es/quiz/trivia-espacial' },
            { hreflang: 'x-default', href: '/en/quiz/space-trivia' },
          ],
        },
      ],
      SITE_URL
    );

    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="es" href="https://quizverse.org/es/quiz/trivia-espacial"/>'
    );
    expect(xml).toContain('hreflang="x-default"');
  });

  it('no emite alternates cuando la entrada no los declara', () => {
    const xml = generateSitemapXml([{ url: '/en/about' }], SITE_URL);
    expect(xml).not.toContain('xhtml:link');
  });

  it('escapa las URLs de los alternates', () => {
    const xml = generateSitemapXml(
      [{ url: '/en/quiz/a', alternates: [{ hreflang: 'es', href: '/es/quiz/b&c' }] }],
      SITE_URL
    );
    expect(xml).toContain('href="https://quizverse.org/es/quiz/b&amp;c"');
  });
});

describe('itemListNode', () => {
  const items = [
    { name: 'Space Trivia', path: '/en/quiz/space-trivia' },
    { name: 'Movie Night', path: '/en/quiz/movie-night' },
  ];

  it('returns null for an empty list', () => {
    expect(itemListNode([], 'en')).toBeNull();
  });

  it('lists items with positions starting at 1 and absolute URLs', () => {
    const node = itemListNode(items, 'en');

    expect(node).toMatchObject({ '@type': 'ItemList', numberOfItems: 2 });
    expect(node?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Space Trivia',
        url: `${SITE_URL}/en/quiz/space-trivia`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Movie Night',
        url: `${SITE_URL}/en/quiz/movie-night`,
      },
    ]);
  });

  it('defaults the list name by locale and honors a custom one', () => {
    expect(itemListNode(items, 'en')?.name).toBe('QuizVerse quizzes');
    expect(itemListNode(items, 'es')?.name).toBe('Quizzes de QuizVerse');
    expect(itemListNode(items, 'en', 'Trending')?.name).toBe('Trending');
  });
});

describe('webPageNode', () => {
  it('emits a WebPage anchored to #webpage and part of #website', () => {
    const node = webPageNode('/en/about', 'en', 'About QuizVerse');

    expect(node['@type']).toBe('WebPage');
    expect(node.url).toBe(`${SITE_URL}/en/about`);
    expect(node['@id']).toBe(`${SITE_URL}/en/about#webpage`);
    expect(node.inLanguage).toBe('en');
    expect(node.isPartOf).toEqual({ '@id': `${SITE_URL}/#website` });
  });

  it('marks Spanish pages as inLanguage es', () => {
    expect(webPageNode('/es/about', 'es', 'Acerca').inLanguage).toBe('es');
  });
});

describe('categoryPath and quizPath', () => {
  it('prefixes the locale', () => {
    expect(categoryPath('es', 'movies-tv')).toBe('/es/category/movies-tv');
    expect(quizPath('en', 'space-trivia')).toBe('/en/quiz/space-trivia');
  });

  it('percent-encodes special characters in the slug', () => {
    expect(quizPath('en', 'a&b')).toBe('/en/quiz/a%26b');
    expect(categoryPath('en', 'a&b')).toBe('/en/category/a%26b');
  });
});

describe('localizedPath', () => {
  it('maps the root to the locale prefix', () => {
    expect(localizedPath('es', '/')).toBe('/es');
  });

  it('adds the leading slash when missing', () => {
    expect(localizedPath('en', 'quiz')).toBe('/en/quiz');
  });

  it('keeps paths that already start with a slash', () => {
    expect(localizedPath('en', '/quiz')).toBe('/en/quiz');
  });
});

describe('generateCategoryMetadata', () => {
  it('includes the quiz count in the title (en and es)', () => {
    const en = generateCategoryMetadata({
      name: 'Movies',
      slug: 'movies',
      locale: 'en',
      quizCount: 7,
    });
    const es = generateCategoryMetadata({
      name: 'Cine',
      slug: 'movies',
      locale: 'es',
      quizCount: 7,
    });

    expect(en.title).toBe('Movies: 7 quizzes to play');
    expect(es.title).toBe('Cine: 7 quizzes online');
  });

  it('falls back to a count-less title', () => {
    expect(generateCategoryMetadata({ name: 'Movies', slug: 'movies', locale: 'en' }).title).toBe(
      'Movies quizzes'
    );
    expect(generateCategoryMetadata({ name: 'Cine', slug: 'movies', locale: 'es' }).title).toBe(
      'Quizzes de Cine'
    );
  });

  it('emits canonical and hreflang in both directions with x-default to English', () => {
    const metadata = generateCategoryMetadata({ name: 'Movies', slug: 'movies', locale: 'es' });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/es/category/movies`);
    expect(metadata.alternates?.languages).toEqual({
      es: `${SITE_URL}/es/category/movies`,
      en: `${SITE_URL}/en/category/movies`,
      'x-default': `${SITE_URL}/en/category/movies`,
    });
  });
});

describe('generateProfileMetadata', () => {
  it('keeps profiles out of the index', () => {
    const metadata = generateProfileMetadata({ username: 'diego' });
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it('emits a canonical profile URL', () => {
    const metadata = generateProfileMetadata({ username: 'diego', locale: 'en' });
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/en/profile/diego`);
  });

  it('uses the bio when present and a fallback otherwise', () => {
    expect(generateProfileMetadata({ username: 'diego', bio: 'Quiz maker.' }).description).toBe(
      'Quiz maker.'
    );
    expect(generateProfileMetadata({ username: 'diego', quizzesCreated: 3 }).description).toBe(
      'diego has created 3 quizzes on QuizVerse.'
    );
    expect(
      generateProfileMetadata({ username: 'diego', displayName: 'Diego', locale: 'es' }).description
    ).toBe('Diego ha creado 0 quizzes en QuizVerse.');
  });
});

describe('buildMetadata passthrough', () => {
  it('forwards type, keywords and article timestamps to Open Graph', () => {
    const metadata = buildMetadata({
      title: 'Article',
      description: 'Body.',
      path: '/en/blog/post',
      locale: 'en',
      type: 'article',
      keywords: ['trivia', 'movies'],
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-02-01T00:00:00.000Z',
    });

    expect(metadata.keywords).toEqual(['trivia', 'movies']);
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-02-01T00:00:00.000Z',
    });
  });

  it('emits the alternate OG locale for each locale', () => {
    const en = buildMetadata({ title: 'T', description: 'D', path: '/en', locale: 'en' });
    const es = buildMetadata({ title: 'T', description: 'D', path: '/es', locale: 'es' });

    expect(en.openGraph?.alternateLocale).toEqual(['es_ES']);
    expect(es.openGraph?.alternateLocale).toEqual(['en_US']);
  });

  it('always uses the large-image Twitter card', () => {
    const metadata = buildMetadata({ title: 'T', description: 'D', path: '/en', locale: 'en' });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
