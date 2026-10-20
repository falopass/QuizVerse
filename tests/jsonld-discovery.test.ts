import { describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE_URL } from '@/lib/seo/site';
import { buildGraph, webPageNode } from '@/lib/seo/structured-data';
import type { JsonLdGraph } from '@/lib/seo/structured-data';

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

vi.mock('@/lib/data/public', () => ({
  getExplorePayload: async () => ({
    quizzes: [
      // Va primera en el payload aunque no sea la selección editorial del
      // grid: el ItemList sigue el orden del catálogo, no el visible.
      {
        id: 'q-first',
        slug: 'primera-del-payload',
        title: 'Primera del payload',
        is_featured: false,
        plays_count: 0,
        likes_count: 0,
        quiz_type: 'trivia',
        cover_image_url: null,
        questions: [],
        results: null,
      },
      {
        id: 'q-featured',
        slug: 'portada-destacada',
        title: 'Portada destacada',
        is_featured: true,
        plays_count: 0,
        likes_count: 0,
        quiz_type: 'trivia',
        cover_image_url: null,
        questions: [],
        results: null,
      },
      ...Array.from({ length: 28 }, (_, index) => ({
        id: `q${index + 1}`,
        slug: `quiz-${index + 1}`,
        title: `Quiz ${index + 1}`,
        is_featured: false,
        plays_count: 100 - index,
        likes_count: 0,
        quiz_type: 'trivia',
        cover_image_url: null,
        questions: [],
        results: null,
      })),
    ],
    categories: [],
  }),
  getLeaderboard: async () => [
    {
      rank: 1,
      user: { id: 'u-secret', username: 'top_secret_user', display_name: 'Nombre Oculto' },
      points: 900,
      quizzesPlayed: 12,
    },
  ],
}));

import ExplorerPage from '@/app/[locale]/quiz/page';
import LeaderboardPage from '@/app/[locale]/leaderboard/page';

function findJsonLd(node: ReactNode): JsonLdGraph | null {
  if (!isValidElement(node)) return null;
  const props = node.props as { data?: JsonLdGraph; children?: ReactNode };
  if (node.type === JsonLd) return props.data ?? null;
  const { children } = props;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findJsonLd(child);
    if (found) return found;
  }
  return null;
}

const typesOf = (graph: JsonLdGraph) => graph['@graph'].map((node) => node['@type']);
const nodeOfType = (graph: JsonLdGraph, type: string) =>
  graph['@graph'].find((node) => node['@type'] === type);

describe('JSON-LD de /{locale}/quiz (explorador)', () => {
  it('emite WebPage + ItemList con los primeros 24 quizzes del catálogo', async () => {
    const tree = await ExplorerPage({ params: Promise.resolve({ locale: 'es' }) });
    const graph = findJsonLd(tree);

    expect(graph).not.toBeNull();
    const types = typesOf(graph!);
    expect(types).toContain('WebPage');
    expect(types).toContain('ItemList');
    // La página no muestra migas: tampoco las declara.
    expect(types).not.toContain('BreadcrumbList');

    expect(nodeOfType(graph!, 'WebPage')).toMatchObject({
      url: `${SITE_URL}/es/quiz`,
      name: 'Explora todos los quizzes — trivia, personalidad y fandom',
      inLanguage: 'es',
    });

    const itemList = nodeOfType(graph!, 'ItemList');
    const items = itemList?.itemListElement as Array<{
      position: number;
      name: string;
      url: string;
    }>;
    // El ItemList anuncia hasta 24 quizzes del catálogo en el orden del
    // payload, igual que la página de categoría: de los 30 del fixture
    // quedan fuera quiz-23 a quiz-28.
    const expectedSlugs = [
      'primera-del-payload',
      'portada-destacada',
      ...Array.from({ length: 22 }, (_, index) => `quiz-${index + 1}`),
    ];
    expect(itemList?.numberOfItems).toBe(24);
    expect(items.map((item) => item.url)).toEqual(
      expectedSlugs.map((slug) => `${SITE_URL}/es/quiz/${slug}`)
    );
    expect(items.map((item) => item.position)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1)
    );
  });
});

describe('JSON-LD de /{locale}/leaderboard (ranking)', () => {
  it('emite WebPage + BreadcrumbList, sin ItemList ni datos de usuario', async () => {
    const tree = await LeaderboardPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    const graph = findJsonLd(tree);

    expect(graph).not.toBeNull();
    const types = typesOf(graph!);
    expect(types).toContain('WebPage');
    expect(types).toContain('BreadcrumbList');
    expect(types).not.toContain('ItemList');

    // El ranking muestra personas, pero el JSON-LD no las nombra.
    const serialized = JSON.stringify(graph);
    expect(serialized).not.toContain('top_secret_user');
    expect(serialized).not.toContain('Nombre Oculto');
    expect(serialized).not.toContain('u-secret');

    const breadcrumb = nodeOfType(graph!, 'BreadcrumbList');
    const crumbs = breadcrumb?.itemListElement as Array<{ name: string; item: string }>;
    expect(crumbs.map((crumb) => crumb.name)).toEqual(['Home', 'Player leaderboard']);
    expect(crumbs[1].item).toBe(`${SITE_URL}/en/leaderboard`);
  });
});

describe('buildGraph', () => {
  it('descarta nodos nulos o indefinidos', () => {
    const graph = buildGraph([null, webPageNode('/en/quiz', 'en', 'Quizzes'), undefined]);
    expect(graph['@graph']).toHaveLength(1);
    expect(graph['@graph'][0]['@type']).toBe('WebPage');
  });
});
