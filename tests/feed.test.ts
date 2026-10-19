import { describe, expect, it } from 'vitest';
import { buildAtomFeed } from '@/lib/seo/feed';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/seo/site';
import type { Quiz } from '@/types/quiz';

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
