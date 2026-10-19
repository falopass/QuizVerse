import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Category } from '@/types/quiz';
import { CategoryStrip } from '@/components/home/category-strip';

function makeCategory(overrides: Partial<Category> & Pick<Category, 'id' | 'slug'>): Category {
  return {
    name: overrides.slug,
    description: null,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 0,
    sort_order: 0,
    ...overrides,
  };
}

const CATEGORIES = [
  makeCategory({ id: 'c-music', name: 'Music', slug: 'music', quiz_count: 51 }),
  makeCategory({ id: 'c-gaming', name: 'Gaming', slug: 'gaming', quiz_count: 94 }),
  makeCategory({ id: 'c-movies', name: 'Movies & TV', slug: 'movies-tv', quiz_count: 174 }),
];

describe('CategoryStrip', () => {
  it('enlaza las categorías con href localizado, conteo visible y orden por quiz_count', async () => {
    render(await CategoryStrip({ categories: CATEGORIES, locale: 'es' }));

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/es/category/movies-tv',
      '/es/category/gaming',
      '/es/category/music',
    ]);

    const gaming = screen.getByRole('link', { name: /videojuegos/i });
    expect(gaming).toHaveAttribute('href', '/es/category/gaming');
    expect(gaming).toHaveTextContent('94');
  });

  it('filtra las categorías sin quizzes', async () => {
    render(
      await CategoryStrip({
        categories: [...CATEGORIES, makeCategory({ id: 'c-empty', slug: 'empty' })],
        locale: 'en',
      })
    );

    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: /empty/i })).not.toBeInTheDocument();
  });

  it('no renderiza la sección cuando no hay categorías', async () => {
    const { container } = render(await CategoryStrip({ categories: [], locale: 'es' }));

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
