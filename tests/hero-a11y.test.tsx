/**
 * PERF-06 (WCAG 2.5.3): el nombre accesible del enlace del hero debe coincidir
 * con su texto visible. axe lo marca como label-content-name-mismatch cuando el
 * aria-label agrega separadores que no están en pantalla, y el sello + título
 * son el único texto visible del enlace (el cover va aria-hidden).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Quiz } from '@/types/quiz';

const mocks = vi.hoisted(() => ({
  getHomePayload: vi.fn(),
  getCategoryCounts: vi.fn(async () => new Map<string, number>()),
}));

vi.mock('@/lib/data/public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/public')>();
  return { ...actual, getHomePayload: mocks.getHomePayload };
});

vi.mock('@/lib/data/category-counts', () => ({
  getCategoryCounts: mocks.getCategoryCounts,
}));

// CategoryStrip es un server component async: suspende en el render síncrono
// del test y no aporta a las aserciones del hero. RecentlyPlayed lee
// localStorage al montar y dispara un update fuera de act().
vi.mock('@/components/home/category-strip', () => ({
  CategoryStrip: () => null,
}));

vi.mock('@/components/home/recently-played', () => ({
  RecentlyPlayed: () => null,
}));

import LocalizedHomePage from '@/app/[locale]/(inicio)/page';

const TITLE = 'World Flags Trivia: Can You Name These 8 Flags?';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-hero',
    slug: 'flags-trivia',
    title: TITLE,
    description: null,
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [],
    results: null,
    tags: [],
    estimated_minutes: 4,
    plays_count: 10,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: true,
    is_ai_generated: false,
    published_at: '2026-10-01T00:00:00.000Z',
    updated_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    category: {
      id: 'cat-pop',
      name: 'Pop Culture',
      slug: 'pop-culture',
      description: null,
      icon: null,
      color: null,
      gradient_from: null,
      gradient_to: null,
      quiz_count: 1,
      sort_order: 1,
    },
    ...overrides,
  };
}

// Texto visible del enlace: cada nodo de texto separado por un espacio, como lo
// pinta el navegador al unir bloques (textContent los pegaría sin separador).
function visibleText(element: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(element);
  return parts.join(' ').replace(/\s+/g, ' ').toLowerCase();
}

async function renderHome(locale: 'en' | 'es') {
  const quiz = makeQuiz({ language: locale });
  mocks.getHomePayload.mockResolvedValue({
    categories: [],
    trending: [],
    featured: [quiz],
    quickPlays: [],
    freshlyPublished: [],
    totalQuizzes: 1,
    totalPlays: 10,
  });

  const { container } = render(await LocalizedHomePage({ params: Promise.resolve({ locale }) }));
  const link = container.querySelector<HTMLAnchorElement>('a.arcade-hero-link');
  expect(link).not.toBeNull();
  return link!;
}

beforeEach(() => {
  mocks.getHomePayload.mockReset();
  mocks.getCategoryCounts.mockReset();
  mocks.getCategoryCounts.mockResolvedValue(new Map<string, number>());
});

describe('hero de la home · nombre accesible (PERF-06)', () => {
  it.each([
    ['en', 'Featured'],
    ['es', 'Destacado'],
  ] as const)('en /%s el aria-label es exactamente el texto visible', async (locale, stamp) => {
    const link = await renderHome(locale);

    // Todo el texto visible del enlace es sello + título, y el nombre accesible
    // es exactamente ese texto: nada de separadores ni añadidos que no se vean.
    const visible = visibleText(link);
    expect(visible).toBe(`${stamp} / 001 ${TITLE}`.toLowerCase());
    expect(link.getAttribute('aria-label')?.toLowerCase()).toBe(visible);
  });

  it('el CTA principal entra directo en modo Clásico', async () => {
    const quiz = makeQuiz();
    mocks.getHomePayload.mockResolvedValue({
      categories: [],
      trending: [],
      featured: [quiz],
      quickPlays: [],
      freshlyPublished: [],
      totalQuizzes: 1,
      totalPlays: 10,
    });

    const { container } = render(
      await LocalizedHomePage({ params: Promise.resolve({ locale: 'en' }) })
    );

    expect(
      container.querySelector<HTMLAnchorElement>('a.arcade-button')?.getAttribute('href')
    ).toBe('/en/quiz/flags-trivia/play?mode=classic');
  });
});

describe('portada · mazo de accesos y destacado sin repetir', () => {
  function payloadWith(quizzes: Quiz[]) {
    return {
      categories: [],
      trending: [],
      featured: quizzes,
      quickPlays: [],
      freshlyPublished: [],
      totalQuizzes: quizzes.length,
      totalPlays: 10,
    };
  }

  it.each([
    ['en', 'Daily quiz', 'Random quiz', 'Challenge #'],
    ['es', 'Quiz diario', 'Quiz al azar', 'Reto #'],
  ] as const)(
    'en /%s el mazo enlaza reto diario, azar, personalidad y trivia',
    async (locale, daily, random, challenge) => {
      mocks.getHomePayload.mockResolvedValue(payloadWith([makeQuiz({ language: locale })]));

      const { container } = render(
        await LocalizedHomePage({ params: Promise.resolve({ locale }) })
      );

      const cards = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.qv-l9-card'));
      expect(cards.map((card) => card.getAttribute('href'))).toEqual([
        `/${locale}/daily`,
        `/${locale}/random`,
        `/${locale}/category/personality`,
        `/${locale}/category/trivia`,
      ]);
      expect(cards[0]).toHaveTextContent(daily);
      // El número del reto es el real del día, no texto inventado.
      expect(cards[0].textContent).toMatch(new RegExp(`${challenge}[0-9]+`));
      expect(cards[1]).toHaveTextContent(random);
      // El tamaño del catálogo sale del payload.
      expect(cards[1]).toHaveTextContent('1 quizzes');
    }
  );

  it('el destacado no se repite como segundo bloque diario', async () => {
    // Un único quiz de trivia: antes era a la vez destacado y «quiz de hoy».
    mocks.getHomePayload.mockResolvedValue(payloadWith([makeQuiz()]));

    const { container } = render(
      await LocalizedHomePage({ params: Promise.resolve({ locale: 'en' }) })
    );

    const detailLinks = container.querySelectorAll('a[href="/en/quiz/flags-trivia"]');
    // Solo el arte del hero enlaza a la ficha del destacado.
    expect(detailLinks).toHaveLength(1);
    expect(detailLinks[0]).toHaveClass('arcade-hero-link');
    expect(container.textContent).not.toContain("Today's quiz");
  });

  it('el mazo va antes de la grilla de juegos y el CTA del hero sigue siendo el primero', async () => {
    mocks.getHomePayload.mockResolvedValue(payloadWith([makeQuiz()]));

    const { container } = render(
      await LocalizedHomePage({ params: Promise.resolve({ locale: 'es' }) })
    );

    const links = Array.from(container.querySelectorAll('a'));
    const cta = links.findIndex((link) => link.classList.contains('arcade-button'));
    const firstCard = links.findIndex((link) => link.classList.contains('qv-l9-card'));
    expect(cta).toBe(0);
    expect(firstCard).toBeGreaterThan(cta);
    const games = container.querySelector('#games');
    expect(games).not.toBeNull();
    const deck = container.querySelector('.qv-l9-deck');
    expect(deck!.compareDocumentPosition(games!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
