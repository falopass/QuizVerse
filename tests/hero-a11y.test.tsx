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
}));

vi.mock('@/lib/data/public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/public')>();
  return { ...actual, getHomePayload: mocks.getHomePayload };
});

vi.mock('@/lib/data/category-counts', () => ({
  getCategoryCounts: vi.fn(async () => new Map<string, number>()),
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

import LocalizedHomePage from '@/app/[locale]/page';

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
});

describe('hero de la home · nombre accesible (PERF-06)', () => {
  it.each([
    ['en', 'Featured'],
    ['es', 'Destacado'],
  ] as const)('en /%s el aria-label es exactamente el texto visible', async (locale, stamp) => {
    const link = await renderHome(locale);

    // Sello + título, separados por un espacio: lo mismo que se ve.
    expect(link.getAttribute('aria-label')).toBe(`${stamp} / 001 ${TITLE}`);
    expect(link.textContent).toContain(`${stamp} / 001`);
    expect(link.textContent).toContain(TITLE);
    // El separador que provocaba el mismatch no debe volver.
    expect(link.getAttribute('aria-label')).not.toContain('·');
  });
});
