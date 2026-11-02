/**
 * SEO-I18N-06: el footer solo enlaza categorías con quizzes publicados en el
 * locale. Un hub vacío hace notFound(), así que enlazar las 16 conocidas
 * creaba 404 internos desde todas las páginas.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { Footer } from '@/components/layout/footer';
import { getDictionary } from '@/lib/i18n/dictionaries';

function categoryNav(name: string) {
  return screen.getByRole('navigation', { name });
}

describe('Footer · categorías', () => {
  it('enlaza solo las categorías con contenido que recibe, en orden', async () => {
    render(
      <Footer
        dictionary={await getDictionary('es')}
        locale="es"
        categorySlugs={['movies-tv', 'gaming', 'science']}
      />
    );

    const nav = categoryNav('Todas las categorías');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/es/category/movies-tv', '/es/category/gaming', '/es/category/science']);
  });

  it('no enlaza categorías vacías en el locale', async () => {
    render(
      <Footer dictionary={await getDictionary('es')} locale="es" categorySlugs={['movies-tv']} />
    );

    const nav = categoryNav('Todas las categorías');
    expect(within(nav).queryByRole('link', { name: 'Videojuegos' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Historia' })).not.toBeInTheDocument();
  });

  it('muestra las etiquetas localizadas de las categorías incluidas', async () => {
    render(
      <Footer
        dictionary={await getDictionary('es')}
        locale="es"
        categorySlugs={['movies-tv', 'science', 'sports']}
      />
    );

    const nav = categoryNav('Todas las categorías');
    for (const label of ['Cine y televisión', 'Ciencia', 'Deportes']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('link', { name: 'Science' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Sports' })).not.toBeInTheDocument();
  });

  it('usa el prefijo de locale en inglés', async () => {
    render(
      <Footer
        dictionary={await getDictionary('en')}
        locale="en"
        categorySlugs={['gaming', 'music']}
      />
    );

    const nav = categoryNav('All categories');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/en/category/gaming', '/en/category/music']);
  });

  it('oculta el nav de categorías si no hay ninguna con contenido', async () => {
    render(<Footer dictionary={await getDictionary('en')} locale="en" categorySlugs={[]} />);

    expect(screen.queryByRole('navigation', { name: 'All categories' })).not.toBeInTheDocument();
  });

  it('conserva el nav principal del pie', async () => {
    render(
      <Footer dictionary={await getDictionary('en')} locale="en" categorySlugs={['gaming']} />
    );

    expect(screen.getByRole('navigation', { name: 'Footer links' })).toBeInTheDocument();
  });
});
