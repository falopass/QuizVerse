import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  locale: 'en',
  pathname: '/en/definitely-missing',
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-quizverse-locale': mocks.locale })),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/components/layout/site-document', () => ({
  SiteDocument: ({ children }: { children: ReactNode }) => children,
}));

import RootNotFound from '@/app/global-not-found';
import LocaleNotFound, {
  generateMetadata as localeNotFoundMetadata,
} from '@/app/[locale]/not-found';
import EmbedNotFound from '@/app/embed/[locale]/not-found';

function categoryLinks() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.includes('/category/'));
}

describe('RootNotFound (src/app/global-not-found.tsx)', () => {
  it('muestra copy en inglés y enlaces /en con cabecera en', async () => {
    mocks.locale = 'en';
    render(await RootNotFound());

    expect(
      screen.getByRole('heading', { name: 'That page drifted out of orbit.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('link', { name: 'Surprise me' })).toHaveAttribute('href', '/en/random');

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
    render(await RootNotFound());

    expect(
      screen.getByRole('heading', { name: 'Esta página se salió de órbita.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar quizzes' })).toHaveAttribute(
      'href',
      '/es/quiz'
    );
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es');
    expect(screen.getByRole('link', { name: 'Sorpréndeme' })).toHaveAttribute('href', '/es/random');

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

describe('LocaleNotFound (src/app/[locale]/not-found.tsx)', () => {
  it('deriva el locale del segmento /es sin leer headers', () => {
    mocks.pathname = '/es/quiz/es-no-existe';
    render(<LocaleNotFound />);

    expect(
      screen.getByRole('heading', { name: 'Esta página se salió de órbita.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar quizzes' })).toHaveAttribute(
      'href',
      '/es/quiz'
    );
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es');
    expect(screen.getByRole('link', { name: 'Sorpréndeme' })).toHaveAttribute('href', '/es/random');
    for (const link of categoryLinks()) {
      expect(link.getAttribute('href')).toMatch(/^\/es\/category\/[a-z-]+$/);
    }
  });

  it('deriva el locale del segmento /en', () => {
    mocks.pathname = '/en/category/nope';
    render(<LocaleNotFound />);

    expect(
      screen.getByRole('heading', { name: 'That page drifted out of orbit.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );
    expect(screen.getByRole('link', { name: 'Surprise me' })).toHaveAttribute('href', '/en/random');
  });

  it('cae a inglés cuando la ruta no empieza por /es', () => {
    mocks.pathname = '/espanol/quiz/x';
    render(<LocaleNotFound />);

    expect(
      screen.getByRole('heading', { name: 'That page drifted out of orbit.' })
    ).toBeInTheDocument();
  });
});

describe('LocaleNotFound metadata (el <title> del shell de error)', () => {
  it('usa el locale de params cuando Next lo interpola', async () => {
    // La cabecera dice lo contrario a propósito: mandan los params.
    mocks.locale = 'en';
    const metadata = await localeNotFoundMetadata({
      params: Promise.resolve({ locale: 'es' }),
    });

    expect(metadata.title).toBe('Página no encontrada');
  });

  it('cae a la cabecera x-quizverse-locale cuando no hay params', async () => {
    mocks.locale = 'es';
    const metadata = await localeNotFoundMetadata({ params: Promise.resolve({}) });

    expect(metadata.title).toBe('Página no encontrada');
  });

  it('en inglés devuelve el título inglés', async () => {
    mocks.locale = 'en';
    const metadata = await localeNotFoundMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(metadata.title).toBe('Page not found');
  });
});

describe('EmbedNotFound (src/app/embed/[locale]/not-found.tsx)', () => {
  it('muestra el 404 del embed en español bajo /embed/es', () => {
    mocks.pathname = '/embed/es/no-existe';
    render(<EmbedNotFound />);

    expect(screen.getByRole('heading', { name: 'Este quiz no existe.' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  });

  it('muestra el 404 del embed en inglés bajo /embed/en', () => {
    mocks.pathname = '/embed/en/no-existe';
    render(<EmbedNotFound />);

    expect(screen.getByRole('heading', { name: 'This quiz does not exist.' })).toBeInTheDocument();
  });
});
