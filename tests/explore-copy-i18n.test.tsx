import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getExploreCopy } from '@/lib/i18n/explore-copy';
import { ExploreEditorialPage } from '@/components/home/explore-editorial-page';
import type { Category, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

const LOCALES: Locale[] = ['es', 'en'];

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
    created_at: '2026-01-01',
    updated_at: null,
    ...overrides,
  };
}

const CATEGORY: Category = {
  id: 'c1',
  name: 'Cine',
  slug: 'cine',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 30,
  sort_order: 0,
};

const QUIZZES = Array.from({ length: 30 }, (_, index) =>
  makeQuiz({ id: `q${index}`, slug: `quiz-${index}`, title: `Quiz ${index}` })
);

function renderPage(locale: Locale) {
  return render(
    <ExploreEditorialPage
      locale={locale}
      quizzes={QUIZZES}
      categories={[CATEGORY]}
      copy={{
        title: 'title',
        subtitle: 'subtitle',
        searchPlaceholder: locale === 'es' ? 'Busca un quiz' : 'Find a quiz',
        emptyTitle: 'empty',
        emptyBody: 'empty body',
        allCategories: locale === 'es' ? 'Todas' : 'All',
      }}
    />
  );
}

describe('getExploreCopy', () => {
  it('expone las mismas claves en ambos idiomas y sin cadenas vacías', () => {
    const es = getExploreCopy('es');
    const en = getExploreCopy('en');

    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());

    for (const locale of LOCALES) {
      const copy = getExploreCopy(locale);
      for (const [key, value] of Object.entries(copy)) {
        const resolved = typeof value === 'function' ? value(3) : value;
        expect(resolved.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it.each(LOCALES)('render del explorador en %s usa el copy del idioma', (locale) => {
    const copy = getExploreCopy(locale);
    renderPage(locale);

    expect(
      screen.getByPlaceholderText(locale === 'es' ? 'Busca un quiz' : 'Find a quiz')
    ).toBeInTheDocument();
    expect(screen.getByText(copy.search)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.showMore(12) })).toBeInTheDocument();
  });
});

describe('explore-editorial-page.tsx', () => {
  it('no contiene literales de copy movidos al módulo i18n', () => {
    const source = readFileSync(
      path.join(__dirname, '../src/components/home/explore-editorial-page.tsx'),
      'utf8'
    );

    const literals = LOCALES.flatMap((locale) => {
      const copy = getExploreCopy(locale);
      return Object.values(copy).map((value) =>
        typeof value === 'function' ? value(0).replace(/\d+/, '${count}') : value
      );
    });

    for (const literal of literals) {
      expect(source, literal).not.toContain(`'${literal}'`);
      expect(source, literal).not.toContain(`\`${literal}\``);
    }
  });
});
