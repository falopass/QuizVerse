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
    quizzes: Array.from({ length: 30 }, (_, index) => ({
      id: `q${index + 1}`,
      slug: `quiz-${index + 1}`,
      title: `Quiz ${index + 1}`,
      questions: [{ id: `qq${index + 1}` }],
      results: [{ id: `qr${index + 1}` }],
    })),
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
  it('emite WebPage + ItemList con a lo sumo 24 quizzes', async () => {
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
    expect(itemList?.numberOfItems).toBe(24);
    expect(items).toHaveLength(24);
    expect(items[0]).toMatchObject({
      position: 1,
      name: 'Quiz 1',
      url: `${SITE_URL}/es/quiz/quiz-1`,
    });
    expect(items[23].url).toBe(`${SITE_URL}/es/quiz/quiz-24`);
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
