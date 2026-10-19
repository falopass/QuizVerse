import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { Footer } from '@/components/layout/footer';
import { getDictionary } from '@/lib/i18n/dictionaries';

const SLUGS = [
  'movies-tv',
  'anime-manga',
  'gaming',
  'music',
  'lifestyle',
  'culture',
  'literature',
  'pop-culture',
];

function categoryNav(name: string) {
  return screen.getByRole('navigation', { name });
}

describe('Footer · categorías', () => {
  it('enlaza las 8 categorías con prefijo de locale en español', async () => {
    render(<Footer dictionary={await getDictionary('es')} locale="es" />);

    const nav = categoryNav('Todas las categorías');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(8);
    links.forEach((link, index) => {
      expect(link).toHaveAttribute('href', `/es/category/${SLUGS[index]}`);
    });
  });

  it('muestra las etiquetas localizadas en español', async () => {
    render(<Footer dictionary={await getDictionary('es')} locale="es" />);

    const nav = categoryNav('Todas las categorías');
    ['Cine y televisión', 'Anime y manga', 'Videojuegos', 'Música'].forEach((label) => {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    });
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
