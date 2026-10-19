import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  pathname: '/es',
  useSupabase: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}));

import EditorialPage, { generateMetadata } from '@/app/[locale]/editorial/page';
import { FloatingNav } from '@/components/layout/floating-nav';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { SITE_URL } from '@/lib/seo/site';

type Node = Record<string, unknown>;

interface Graph {
  '@context': string;
  '@graph': Node[];
}

const params = (locale: string) => Promise.resolve({ locale });

async function renderPage(locale: string) {
  const { container } = render(await EditorialPage({ params: params(locale) }));
  return container;
}

async function renderGraph(locale: string): Promise<Graph> {
  const container = await renderPage(locale);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML) as Graph;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/es';
  mocks.useSupabase.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
});

describe('generateMetadata — /[locale]/editorial', () => {
  it('emite canonical del locale y hreflang al otro idioma', async () => {
    const es = await generateMetadata({ params: params('es') });
    expect(es.alternates?.canonical).toBe(`${SITE_URL}/es/editorial`);
    expect(es.alternates?.languages).toMatchObject({
      es: `${SITE_URL}/es/editorial`,
      en: `${SITE_URL}/en/editorial`,
      'x-default': `${SITE_URL}/en/editorial`,
    });

    const en = await generateMetadata({ params: params('en') });
    expect(en.alternates?.canonical).toBe(`${SITE_URL}/en/editorial`);
    expect(en.alternates?.languages).toMatchObject({
      en: `${SITE_URL}/en/editorial`,
      es: `${SITE_URL}/es/editorial`,
      'x-default': `${SITE_URL}/en/editorial`,
    });
  });

  it('cae al default en con un locale desconocido', async () => {
    const meta = await generateMetadata({ params: params('fr') });
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/en/editorial`);
  });
});

describe('JSON-LD — /[locale]/editorial', () => {
  it('emite AboutPage con @id propio, isPartOf del sitio y about de la organización', async () => {
    const graph = await renderGraph('es');
    const aboutPage = graph['@graph'].find((node) => node['@type'] === 'AboutPage');

    expect(aboutPage).toMatchObject({
      '@id': `${SITE_URL}/es/editorial#aboutpage`,
      url: `${SITE_URL}/es/editorial`,
      inLanguage: 'es',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
    });
  });

  it('emite BreadcrumbList Inicio → página en ambos idiomas', async () => {
    for (const [locale, home, title] of [
      ['es', 'Inicio', 'Cómo trabajamos'],
      ['en', 'Home', 'How we work'],
    ] as const) {
      const graph = await renderGraph(locale);
      const breadcrumb = graph['@graph'].find((node) => node['@type'] === 'BreadcrumbList');
      expect(breadcrumb).toBeDefined();

      const items = breadcrumb!.itemListElement as Node[];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ position: 1, name: home, item: `${SITE_URL}/${locale}` });
      expect(items[1]).toMatchObject({
        position: 2,
        name: title,
        item: `${SITE_URL}/${locale}/editorial`,
      });
    }
  });
});

describe('contenido bilingüe — /[locale]/editorial', () => {
  it('es y en renderizan las mismas secciones, en el mismo orden', async () => {
    const es = await renderPage('es');
    const en = await renderPage('en');

    const keysOf = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('main section[data-section]')).map(
        (s) => (s as HTMLElement).dataset.section
      );

    const esKeys = keysOf(es);
    expect(esKeys.length).toBeGreaterThanOrEqual(4);
    expect(esKeys).toEqual(keysOf(en));
  });

  it('ningún encabezado queda sin traducir entre idiomas', async () => {
    const es = await renderPage('es');
    const en = await renderPage('en');

    const headingsOf = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('main h2')).map((h) => h.textContent?.trim());

    const esHeadings = headingsOf(es);
    const enHeadings = headingsOf(en);
    expect(esHeadings).toHaveLength(enHeadings.length);
    esHeadings.forEach((heading, i) => {
      expect(heading).not.toBe(enHeadings[i]);
    });
  });

  it('enlaza al catálogo, a categorías pobladas y a contacto en ambos idiomas', async () => {
    for (const locale of ['es', 'en'] as const) {
      const container = await renderPage(locale);
      const hrefs = Array.from(container.querySelectorAll('main a')).map((a) =>
        a.getAttribute('href')
      );

      for (const path of [
        `/${locale}/quiz`,
        `/${locale}/category/movies-tv`,
        `/${locale}/category/anime-manga`,
        `/${locale}/category/gaming`,
        `/${locale}/category/music`,
        `/${locale}/contact`,
        `/${locale}/about`,
      ]) {
        expect(hrefs).toContain(path);
      }
    }
  });
});

describe('descubrimiento — navegación y layout', () => {
  it('FloatingNav enlaza a /editorial en la nav principal y en el menú móvil', async () => {
    const dictionary = await getDictionary('es');
    const { container } = render(
      React.createElement(FloatingNav, { locale: 'es', dictionary })
    );

    const desktop = container.querySelector('a[href="/es/editorial"]');
    expect(desktop?.textContent).toContain('Cómo trabajamos');

    fireEvent.click(screen.getByRole('button', { name: /menú/i }));
    const mobile = document
      .getElementById('arcade-mobile-menu')
      ?.querySelector('a[href="/es/editorial"]');
    expect(mobile?.textContent).toContain('Cómo trabajamos');
  });

  it('FloatingNav usa el copy en inglés bajo locale en', async () => {
    const dictionary = await getDictionary('en');
    const { container } = render(
      React.createElement(FloatingNav, { locale: 'en', dictionary })
    );

    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    const links = Array.from(container.querySelectorAll('a[href="/en/editorial"]'));
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link.textContent).toContain('How we work'));
  });

  it('el layout raíz no declara canonical propio', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(source).not.toMatch(/canonical/);
  });
});
