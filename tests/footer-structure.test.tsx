/**
 * Footer ordenado: las acciones de cuenta (Entrar, Crear cuenta,
 * Notificaciones) viven en el header/menú, no en el pie. El pie conserva
 * la fila legal (privacidad, términos, cookies) y las categorías con
 * contenido del locale.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Footer } from '@/components/layout/footer';
import { getDictionary } from '@/lib/i18n/dictionaries';

async function renderFooter(locale: 'en' | 'es', categorySlugs: string[]) {
  render(
    <Footer
      dictionary={await getDictionary(locale)}
      locale={locale}
      categorySlugs={categorySlugs}
    />
  );
  return screen.getByRole('contentinfo');
}

describe('Footer · estructura', () => {
  it('no enlaza a /login, /register ni /notifications', async () => {
    const footer = await renderFooter('es', ['gaming']);

    const hrefs = Array.from(footer.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/es/login');
    expect(hrefs).not.toContain('/es/register');
    expect(hrefs).not.toContain('/es/notifications');
  });

  it('mantiene privacidad, términos y preferencias de cookies en la fila legal', async () => {
    const footer = await renderFooter('es', []);

    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/es/privacy');
    expect(screen.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', '/es/terms');
    expect(screen.getByRole('button', { name: 'Preferencias de cookies' })).toBeInTheDocument();
    expect(footer.textContent).toContain(`© ${new Date().getFullYear()} QuizVerse`);
  });

  it('enlaza las categorías recibidas', async () => {
    const footer = await renderFooter('es', ['movies-tv', 'science']);

    const hrefs = Array.from(footer.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/es/category/movies-tv');
    expect(hrefs).toContain('/es/category/science');
    expect(hrefs).not.toContain('/es/category/gaming');
  });

  it('agrupa los enlaces en Jugar y QuizVerse', async () => {
    await renderFooter('en', []);

    const play = screen.getByRole('navigation', { name: 'Play' });
    expect(play.textContent).toContain('Explore');
    expect(play.textContent).toContain('Catalog index');
    expect(play.textContent).toContain('Leaderboard');
    expect(play.textContent).toContain('Create quiz');

    const brand = screen.getByRole('navigation', { name: 'QuizVerse' });
    expect(brand.textContent).toContain('About');
    expect(brand.textContent).toContain('FAQ');
    expect(brand.textContent).toContain('Contact');
  });
});
