/**
 * Tests for the quiz detail JSON-LD graph and the <script> escaping invariant.
 *
 * The detail page emits one graph per page (WebPage + Quiz + BreadcrumbList)
 * that Google reads as a rich result, and <JsonLd> must never let a
 * user-controlled title break out of the script tag.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildGraph,
  breadcrumbNode,
  quizNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';
import { SITE_URL } from '@/lib/seo/site';
import type { Category, Quiz } from '@/types/quiz';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'space-trivia',
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    questions: [
      {
        id: 'q1',
        question: '¿Qué planeta tiene más lunas?',
        options: [
          { id: 'q1a', text: 'Saturno', is_correct: true },
          { id: 'q1b', text: 'Marte' },
        ],
      },
      {
        id: 'q2',
        question: '¿De qué está hecha la Luna?',
        options: [
          { id: 'q2a', text: 'Roca', is_correct: true },
          { id: 'q2b', text: 'Queso' },
        ],
      },
      {
        id: 'q3',
        question: '¿Qué es un año luz?',
        options: [
          { id: 'q3a', text: 'Distancia', is_correct: true },
          { id: 'q3b', text: 'Tiempo' },
        ],
      },
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
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: null,
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

const category: Category = {
  id: 'cat-science',
  name: 'Ciencia',
  slug: 'science',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 3,
  sort_order: 1,
};

const IMAGE_URL = `${SITE_URL}/es/quiz/space-trivia/opengraph-image`;

function detailGraph(quiz: Quiz) {
  const path = quizPath('es', quiz.slug);
  return buildGraph([
    webPageNode(path, 'es', quiz.title),
    quizNode({
      quiz,
      locale: 'es',
      category,
      description: quiz.description ?? '',
      imageUrl: IMAGE_URL,
    }),
    breadcrumbNode([
      { name: 'Inicio', path: '/es' },
      { name: 'Explorar', path: '/es/quiz' },
      { name: category.name, path: '/es/category/science' },
      { name: quiz.title, path },
    ]),
  ]);
}

describe('quiz detail JSON-LD graph', () => {
  it('emits one context with exactly the three page nodes', () => {
    const graph = detailGraph(makeQuiz());

    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph']).toHaveLength(3);
    expect(graph['@graph'].map((node) => node['@type'])).toEqual([
      'WebPage',
      'Quiz',
      'BreadcrumbList',
    ]);
  });

  it('describes the Quiz node with real properties', () => {
    const quiz = makeQuiz();
    const graph = detailGraph(quiz);
    const node = graph['@graph'].find((n) => n['@type'] === 'Quiz');

    expect(node).toBeDefined();
    expect(node?.name).toBe(quiz.title);
    expect(node?.url).toBe(`${SITE_URL}/es/quiz/space-trivia`);
    expect(node?.inLanguage).toBe('es');
    expect(node?.isAccessibleForFree).toBe(true);
    expect(node?.numberOfQuestions).toBe(3);
    expect(node?.timeRequired).toMatch(/^PT\d+M$/);
    expect(node?.timeRequired).toBe('PT4M');
    expect(node?.image).toMatchObject({ url: IMAGE_URL });
    expect(node?.about).toMatchObject({ name: 'Ciencia' });
  });

  it('numbers BreadcrumbList positions from 1 with absolute URLs', () => {
    const graph = detailGraph(makeQuiz());
    const crumbs = graph['@graph'].find((n) => n['@type'] === 'BreadcrumbList');

    expect(crumbs).toBeDefined();
    const items = crumbs?.itemListElement as Array<{
      position: number;
      name: string;
      item: string;
    }>;
    expect(items.map((item) => item.position)).toEqual([1, 2, 3, 4]);
    for (const item of items) {
      expect(item.item).toMatch(/^https:\/\//);
    }
    expect(items[3].item).toBe(`${SITE_URL}/es/quiz/space-trivia`);
  });

  it('links the WebPage to the site-wide WebSite node', () => {
    const graph = detailGraph(makeQuiz());
    const page = graph['@graph'].find((n) => n['@type'] === 'WebPage');

    expect(page?.['@id']).toBe(`${SITE_URL}/es/quiz/space-trivia#webpage`);
    expect(page?.['@id']).toMatch(/#webpage$/);
    expect(page?.isPartOf).toEqual({ '@id': `${SITE_URL}/#website` });
  });
});

describe('quizNode conditionals', () => {
  it('omits datePublished and dateModified without published_at', () => {
    const node = quizNode({
      quiz: makeQuiz({ published_at: null }),
      locale: 'es',
      category,
      description: 'x',
      imageUrl: IMAGE_URL,
    });

    expect(node).not.toHaveProperty('datePublished');
    expect(node).not.toHaveProperty('dateModified');
  });

  it('emits both dates when published_at exists', () => {
    const quiz = makeQuiz();
    const node = quizNode({
      quiz,
      locale: 'es',
      category,
      description: 'x',
      imageUrl: IMAGE_URL,
    });

    expect(node.datePublished).toBe(quiz.published_at);
    expect(node.dateModified).toBe(quiz.published_at);
  });

  it('omits keywords when the quiz has no tags', () => {
    const node = quizNode({
      quiz: makeQuiz({ tags: [] }),
      locale: 'es',
      category,
      description: 'x',
      imageUrl: IMAGE_URL,
    });

    expect(node).not.toHaveProperty('keywords');
  });

  it('omits interactionStatistic when nobody has played', () => {
    const node = quizNode({
      quiz: makeQuiz({ plays_count: 0 }),
      locale: 'es',
      category,
      description: 'x',
      imageUrl: IMAGE_URL,
    });

    expect(node).not.toHaveProperty('interactionStatistic');
  });
});

describe('JsonLd escaping', () => {
  it('escapes </script> so a title cannot break out of the tag', () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { name: '</script><img onerror=alert(1)>' } })
    );

    expect(html).toContain('application/ld+json');
    expect(html).not.toContain('</script><img');
    expect(html).toContain('\\u003c/script\\u003e');
    // The only literal "</script>" in the markup is the component's own closing tag.
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
