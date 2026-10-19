import { describe, expect, it } from 'vitest';

import {
  categoryDescription,
  countLabel,
  quizCountLabel,
  visibleGamesLabel,
} from '@/lib/i18n/counts';
import { generateCategoryMetadata } from '@/lib/seo/metadata';

describe('countLabel', () => {
  it.each([
    [0, '0 quizzes'],
    [1, '1 quiz'],
    [2, '2 quizzes'],
    [99, '99 quizzes'],
  ] as const)('es: %i → %s', (count, expected) => {
    expect(countLabel(count, 'es', 'quiz', 'quizzes')).toBe(expected);
  });

  it.each([
    [0, '0 quizzes'],
    [1, '1 quiz'],
    [2, '2 quizzes'],
    [99, '99 quizzes'],
  ] as const)('en: %i → %s', (count, expected) => {
    expect(countLabel(count, 'en', 'quiz', 'quizzes')).toBe(expected);
  });
});

describe('visibleGamesLabel', () => {
  it.each([
    [0, '0 juegos mostrados'],
    [1, '1 juego mostrado'],
    [2, '2 juegos mostrados'],
    [99, '99 juegos mostrados'],
  ] as const)('es: %i → %s', (count, expected) => {
    expect(visibleGamesLabel(count, 'es')).toBe(expected);
  });

  it.each([
    [0, '0 games shown'],
    [1, '1 game shown'],
    [2, '2 games shown'],
    [99, '99 games shown'],
  ] as const)('en: %i → %s', (count, expected) => {
    expect(visibleGamesLabel(count, 'en')).toBe(expected);
  });
});

describe('categoryDescription', () => {
  it.each([0, 1, 2, 99] as const)('es: %i nunca dice "quizzes" en singular', (count) => {
    const text = categoryDescription({ count, name: 'Historia', locale: 'es' });
    expect(text).toContain(`${count} `);
    if (count === 1) {
      expect(text).toContain('1 quiz de Historia');
      expect(text).not.toContain('1 quizzes');
    } else {
      expect(text).toContain(`${count} quizzes de Historia`);
    }
  });

  it.each([0, 1, 2, 99] as const)('en: %i nunca pluraliza con 1', (count) => {
    const text = categoryDescription({ count, name: 'History', locale: 'en' });
    if (count === 1) {
      expect(text).toContain('1 free History quiz on QuizVerse');
      expect(text).not.toContain('1 free History quizzes');
    } else {
      expect(text).toContain(`${count} free History quizzes on QuizVerse`);
    }
  });

  it('antepone el tagline cuando existe', () => {
    expect(
      categoryDescription({ count: 1, name: 'Historia', tagline: 'Rondas afiladas.', locale: 'es' })
    ).toBe(
      'Rondas afiladas. 1 quiz de Historia gratis en QuizVerse, con resultado al instante y sin registro.'
    );
    expect(
      categoryDescription({ count: 12, name: 'History', tagline: 'Sharp rounds.', locale: 'en' })
    ).toBe(
      'Sharp rounds. 12 free History quizzes on QuizVerse, with instant results and no signup.'
    );
  });
});

describe('quizCountLabel', () => {
  it.each([
    [0, '0 quizzes'],
    [1, '1 quiz'],
    [2, '2 quizzes'],
    [99, '99 quizzes'],
  ] as const)('%i → %s', (count, expected) => {
    expect(quizCountLabel(count)).toBe(expected);
  });
});

describe('generateCategoryMetadata title', () => {
  it('usa el singular con 1 quiz en ambos idiomas', () => {
    expect(
      generateCategoryMetadata({ name: 'Historia', slug: 'history', locale: 'es', quizCount: 1 })
        .title
    ).toBe('Historia: 1 quiz online');
    expect(
      generateCategoryMetadata({ name: 'History', slug: 'history', locale: 'en', quizCount: 1 })
        .title
    ).toBe('History: 1 quiz to play');
  });

  it('mantiene el plural con 12 quizzes', () => {
    expect(
      generateCategoryMetadata({ name: 'Cine', slug: 'movies', locale: 'es', quizCount: 12 }).title
    ).toBe('Cine: 12 quizzes online');
    expect(
      generateCategoryMetadata({ name: 'Movies', slug: 'movies', locale: 'en', quizCount: 12 })
        .title
    ).toBe('Movies: 12 quizzes to play');
  });
});
