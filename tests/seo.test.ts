import { describe, expect, it } from 'vitest';
import { buildMetadata, clampDescription } from '@/lib/seo/metadata';
import { generateSitemapXml } from '@/lib/seo/sitemap';
import { buildGraph, breadcrumbNode, isoDuration, quizNode } from '@/lib/seo/structured-data';
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
  updated_at: '2026-05-21T02:58:55.027Z',
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
