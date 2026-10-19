import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { Footer } from '@/components/layout/footer';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { CATEGORY_SLUG_NAMES } from '@/lib/i18n/catalog';

const SLUGS = [
  'movies-tv',
  'anime-manga',
  'gaming',
  'music',
  'lifestyle',
  'culture',
  'literature',
  'pop-culture',
  'technology',
  'relationships',
  'food-drink',
  'science',
  'animals',
  'sports',
  'geography',
  'history',
];

function categoryNav(name: string) {
  return screen.getByRole('navigation', { name });
}

describe('Footer · categorías', () => {
  it('enlaza las 16 categorías con prefijo de locale en español', async () => {
    render(<Footer dictionary={await getDictionary('es')} locale="es" />);

    const nav = categoryNav('Todas las categorías');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(16);
    links.forEach((link, index) => {
      expect(link).toHaveAttribute('href', `/es/category/${SLUGS[index]}`);
    });
  });

  it('enlaza las 16 categorías con prefijo de locale en inglés', async () => {
    render(<Footer dictionary={await getDictionary('en')} locale="en" />);

    const nav = categoryNav('All categories');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(16);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/^\/en\/category\//);
    });
  });

  it('cada slug de CATEGORY_SLUG_NAMES aparece exactamente una vez', async () => {
    expect(Object.keys(CATEGORY_SLUG_NAMES)).toHaveLength(16);

    render(<Footer dictionary={await getDictionary('en')} locale="en" />);

    const nav = categoryNav('All categories');
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs.sort()).toEqual(
      Object.keys(CATEGORY_SLUG_NAMES)
        .map((slug) => `/en/category/${slug}`)
        .sort()
    );
  });

  it('muestra las etiquetas localizadas en español', async () => {
    render(<Footer dictionary={await getDictionary('es')} locale="es" />);

    const nav = categoryNav('Todas las categorías');
    [
      'Cine y televisión',
      'Anime y manga',
      'Videojuegos',
      'Música',
      'Ciencia',
      'Deportes',
      'Tecnología',
      'Relaciones',
      'Comida y bebida',
      'Animales',
      'Geografía',
      'Historia',
    ].forEach((label) => {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    });
    expect(within(nav).queryByRole('link', { name: 'Science' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Sports' })).not.toBeInTheDocument();
  });

  it('muestra las etiquetas en inglés con hrefs /en', async () => {
    render(<Footer dictionary={await getDictionary('en')} locale="en" />);

    const nav = categoryNav('All categories');
    [
      'Movies & TV',
      'Anime & Manga',
      'Gaming',
      'Music',
      'Lifestyle',
      'Culture',
      'Literature',
      'Pop Culture',
      'Technology',
      'Relationships',
      'Food & Drink',
      'Science',
      'Animals',
      'Sports',
      'Geography',
      'History',
    ].forEach((label) => {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    });
    expect(within(nav).getByRole('link', { name: 'Gaming' })).toHaveAttribute(
      'href',
      '/en/category/gaming'
    );
  });

  it('conserva el nav principal del pie', async () => {
    render(<Footer dictionary={await getDictionary('en')} locale="en" />);

    expect(screen.getByRole('navigation', { name: 'Footer links' })).toBeInTheDocument();
  });
});
