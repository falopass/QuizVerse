import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { Footer } from '@/components/layout/footer';
import { getDictionary } from '@/lib/i18n/dictionaries';

describe('Footer · enlace al índice del catálogo', () => {
  it('enlaza a /es/indice con su etiqueta en español', async () => {
    render(<Footer dictionary={await getDictionary('es')} locale="es" />);

    const nav = screen.getByRole('navigation', { name: 'Enlaces del pie' });
    const link = within(nav).getByRole('link', { name: 'Índice del catálogo' });
    expect(link).toHaveAttribute('href', '/es/indice');
  });

  it('enlaza a /en/indice con su etiqueta en inglés', async () => {
    render(<Footer dictionary={await getDictionary('en')} locale="en" />);

    const nav = screen.getByRole('navigation', { name: 'Footer links' });
    const link = within(nav).getByRole('link', { name: 'Catalog index' });
    expect(link).toHaveAttribute('href', '/en/indice');
  });
});
