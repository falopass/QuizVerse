import { describe, expect, it } from 'vitest';
import {
  editorialScore,
  explorerSelection,
  explorerVisibleQuizzes,
} from '@/lib/quiz/editorial-order';
import type { Quiz } from '@/types/quiz';

function makeQuiz(overrides: Partial<Quiz>): Quiz {
  return {
    id: overrides.id ?? 'q1',
    slug: overrides.slug ?? 'quiz-1',
    title: overrides.title ?? 'Quiz 1',
    description: 'desc',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'easy',
    language: 'en',
    questions: [],
    results: null,
    tags: [],
    estimated_minutes: 5,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: null,
    updated_at: null,
    created_at: '2026-01-01',
    ...overrides,
  };
}

const ids = (quizzes: (Quiz | null)[]) => quizzes.map((quiz) => quiz?.id);

describe('editorialScore', () => {
  it('un destacado suma 220 y supera a un quiz popular típico sin destacar', () => {
    const featured = makeQuiz({ id: 'feat', is_featured: true });
    const popular = makeQuiz({
      id: 'pop',
      plays_count: 50,
      likes_count: 10,
      quiz_type: 'personality',
      cover_image_url: '/stock-covers/x.jpg',
    });
    expect(editorialScore(featured)).toBe(220);
    expect(editorialScore(featured)).toBeGreaterThan(editorialScore(popular));
  });

  it('un quiz sin destacar con engagement suficiente puede superar los 220 del destacado', () => {
    const viral = makeQuiz({ id: 'viral', plays_count: 50, likes_count: 40 });
    expect(editorialScore(viral)).toBeGreaterThan(220);
  });

  it('suma 28 por portada de stock y 0 por una portada normal', () => {
    const stock = makeQuiz({ id: 'a', cover_image_url: '/stock-covers/cover.jpg' });
    const normal = makeQuiz({ id: 'b', cover_image_url: 'https://cdn.example.com/c.jpg' });
    expect(editorialScore(stock) - editorialScore(normal)).toBe(28);
  });

  it('suma 6 por quiz de personality', () => {
    const personality = makeQuiz({ id: 'a', quiz_type: 'personality' });
    const trivia = makeQuiz({ id: 'b', quiz_type: 'trivia' });
    expect(editorialScore(personality) - editorialScore(trivia)).toBe(6);
  });

  it('pondera plays_count por 2 y likes_count por 4', () => {
    const base = makeQuiz({ id: 'a' });
    const played = makeQuiz({ id: 'b', plays_count: 7 });
    const liked = makeQuiz({ id: 'c', likes_count: 7 });
    expect(editorialScore(played) - editorialScore(base)).toBe(14);
    expect(editorialScore(liked) - editorialScore(base)).toBe(28);
  });
});

describe('explorerSelection con preferEditorial', () => {
  it('lead es el destacado aunque no sea el primero de la lista', () => {
    const list = [
      makeQuiz({ id: 'first', plays_count: 999 }),
      makeQuiz({ id: 'second' }),
      makeQuiz({ id: 'feat', is_featured: true }),
    ];
    const { lead } = explorerSelection(list);
    expect(lead?.id).toBe('feat');
  });

  it('pulse es el mejor puntuado distinto del lead', () => {
    const list = [
      makeQuiz({ id: 'feat', is_featured: true }),
      makeQuiz({ id: 'strong', plays_count: 50, likes_count: 10 }),
      makeQuiz({ id: 'weak' }),
    ];
    const { lead, pulse } = explorerSelection(list);
    expect(lead?.id).toBe('feat');
    expect(pulse?.id).toBe('strong');
  });

  it('reparte 4 lanes, 12 grid y el resto en rest, sin repetir ningún quiz', () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      makeQuiz({ id: `q${i}`, is_featured: i === 5 })
    );
    const { lead, pulse, lanes, grid, rest } = explorerSelection(list);
    expect(lanes).toHaveLength(4);
    expect(grid).toHaveLength(12);
    expect(rest).toHaveLength(2);
    const all = [lead, pulse, ...lanes, ...grid, ...rest].filter((q): q is Quiz => q !== null);
    expect(new Set(ids(all)).size).toBe(20);
    expect(new Set(ids(all))).toEqual(new Set(ids(list)));
  });
});

describe('explorerSelection con preferEditorial: false', () => {
  it('lead y pulse salen del orden de la lista, sin reordenar por score', () => {
    const list = [
      makeQuiz({ id: 'low' }),
      makeQuiz({ id: 'mid' }),
      makeQuiz({ id: 'feat', is_featured: true, plays_count: 500 }),
    ];
    const { lead, pulse } = explorerSelection(list, { preferEditorial: false });
    expect(lead?.id).toBe('low');
    expect(pulse?.id).toBe('mid');
  });
});

describe('listas cortas y vacías', () => {
  it('[] devuelve lead y pulse null y grupos vacíos', () => {
    const { lead, pulse, lanes, grid, rest } = explorerSelection([]);
    expect(lead).toBeNull();
    expect(pulse).toBeNull();
    expect(lanes).toEqual([]);
    expect(grid).toEqual([]);
    expect(rest).toEqual([]);
  });

  it('con 3 quizzes no inventa huecos', () => {
    const list = [makeQuiz({ id: 'a' }), makeQuiz({ id: 'b' }), makeQuiz({ id: 'c' })];
    const { lead, pulse, lanes, grid, rest } = explorerSelection(list);
    expect(lead).not.toBeNull();
    expect(pulse).not.toBeNull();
    expect(lanes).toHaveLength(1);
    expect(grid).toEqual([]);
    expect(rest).toEqual([]);
  });

  it('con menos de 5 no hay grid', () => {
    const list = Array.from({ length: 4 }, (_, i) => makeQuiz({ id: `q${i}` }));
    const { lanes, grid } = explorerSelection(list);
    expect(lanes).toHaveLength(2);
    expect(grid).toEqual([]);
  });
});

describe('explorerVisibleQuizzes', () => {
  it('devuelve como mucho 18, con lead y pulse primero y sin repetir ids', () => {
    const list = Array.from({ length: 25 }, (_, i) =>
      makeQuiz({ id: `q${i}`, plays_count: i, is_featured: i === 10 })
    );
    const visible = explorerVisibleQuizzes(list);
    const { lead, pulse } = explorerSelection(
      [...list].sort((a, b) => editorialScore(b) - editorialScore(a))
    );
    expect(visible).toHaveLength(18);
    expect(visible[0].id).toBe(lead?.id);
    expect(visible[1].id).toBe(pulse?.id);
    expect(new Set(ids(visible)).size).toBe(18);
  });

  it('con lista vacía devuelve []', () => {
    expect(explorerVisibleQuizzes([])).toEqual([]);
  });
});

describe('desempates', () => {
  it('dos quizzes con el mismo score conservan la longitud total', () => {
    const list = Array.from({ length: 6 }, (_, i) => makeQuiz({ id: `q${i}` }));
    const { lead, pulse, lanes, grid, rest } = explorerSelection(list);
    const all = [lead, pulse, ...lanes, ...grid, ...rest].filter((q): q is Quiz => q !== null);
    expect(all).toHaveLength(6);
    expect(explorerVisibleQuizzes(list)).toHaveLength(6);
  });
});
