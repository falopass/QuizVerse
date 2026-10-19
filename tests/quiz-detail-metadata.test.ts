import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
}));

import { generateMetadata } from '@/app/[locale]/quiz/[slug]/page';
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
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the most moons?',
        options: [
          { id: 'q1a', text: 'Saturn' },
          { id: 'q1b', text: 'Mars' },
        ],
      },
    ],
    results: null,
    tags: Array.from({ length: 10 }, (_, i) => `tag-${i}`),
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

const params = (slug = 'space-trivia') => Promise.resolve({ locale: 'en', slug });

beforeEach(() => {
  mocks.getQuizBySlug.mockReset();
});

describe('generateMetadata — ficha de quiz como artículo', () => {
  it('emite og:type=article, fechas reales y hasta 8 keywords', async () => {
    mocks.getQuizBySlug.mockResolvedValue(makeQuiz());

    const metadata = await generateMetadata({ params: params() });
    const og = metadata.openGraph as Record<string, unknown>;

    expect(og.type).toBe('article');
    expect(og.publishedTime).toBe('2026-05-21T00:00:00.000Z');
    expect(og.modifiedTime).toBe('2026-06-10T00:00:00.000Z');
    expect(metadata.keywords).toHaveLength(8);
    expect(metadata.keywords?.[0]).toBe('tag-0');
  });

  it('omite las claves vacías cuando no hay fechas ni etiquetas', async () => {
    mocks.getQuizBySlug.mockResolvedValue(
      makeQuiz({ published_at: null, updated_at: null, tags: [] })
    );

    const metadata = await generateMetadata({ params: params() });
    const og = metadata.openGraph as Record<string, unknown>;

    expect(og.type).toBe('article');
    expect(og).not.toHaveProperty('publishedTime');
    expect(og).not.toHaveProperty('modifiedTime');
    expect(metadata).not.toHaveProperty('keywords');
    expect(metadata.title).toBe('Space Trivia');
  });

  it('mantiene canonical y hreflang iguales a los de antes', async () => {
    mocks.getQuizBySlug.mockResolvedValue(makeQuiz());

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/en/quiz/space-trivia`);
    expect(metadata.alternates?.languages).toEqual({
      en: `${SITE_URL}/en/quiz/space-trivia`,
      'x-default': `${SITE_URL}/en/quiz/space-trivia`,
    });
  });
});
