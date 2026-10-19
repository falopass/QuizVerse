import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  locale: 'en',
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-quizverse-locale': mocks.locale })),
}));

import NotFoundPage from '@/app/not-found';

function categoryLinks() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.includes('/category/'));
}

describe('NotFoundPage', () => {
  it('muestra copy en inglés y enlaces /en con cabecera en', async () => {
    mocks.locale = 'en';
    render(await NotFoundPage());

    expect(
      screen.getByRole('heading', { name: 'That page drifted out of orbit.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );

    const links = categoryLinks();
    expect(links.length).toBeGreaterThanOrEqual(6);
    expect(links.length).toBeLessThanOrEqual(8);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\/en\/category\/[a-z-]+$/);
    }
    expect(screen.getByRole('link', { name: 'Movies & TV' })).toHaveAttribute(
      'href',
      '/en/category/movies-tv'
    );
  });

  it('muestra copy en español y enlaces /es con cabecera es', async () => {
    mocks.locale = 'es';
    render(await NotFoundPage());

    expect(
      screen.getByRole('heading', { name: 'Esta página se salió de órbita.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar quizzes' })).toHaveAttribute(
      'href',
      '/es/quiz'
    );

    const links = categoryLinks();
    expect(links.length).toBeGreaterThanOrEqual(6);
    expect(links.length).toBeLessThanOrEqual(8);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\/es\/category\/[a-z-]+$/);
    }
    expect(screen.getByRole('link', { name: 'Cine y televisión' })).toHaveAttribute(
      'href',
      '/es/category/movies-tv'
    );
  });
});
