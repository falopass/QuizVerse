import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import AboutPage from '@/app/[locale]/about/page';
import ContactPage from '@/app/[locale]/contact/page';
import PrivacyPage from '@/app/[locale]/privacy/page';
import TermsPage from '@/app/[locale]/terms/page';
import { SITE_URL } from '@/lib/seo/site';

type Node = Record<string, unknown>;

interface Graph {
  '@context': string;
  '@graph': Node[];
}

const pages = [
  {
    name: 'about',
    component: AboutPage,
    esTitle: 'Acerca de QuizVerse',
    enTitle: 'About QuizVerse',
  },
  { name: 'contact', component: ContactPage, esTitle: 'Contacto', enTitle: 'Contact' },
  {
    name: 'privacy',
    component: PrivacyPage,
    esTitle: 'Política de Privacidad',
    enTitle: 'Privacy Policy',
  },
  {
    name: 'terms',
    component: TermsPage,
    esTitle: 'Términos de Servicio',
    enTitle: 'Terms of Service',
  },
] as const;

async function renderGraph(
  Page: (props: { params: Promise<{ locale: string }> }) => Promise<React.JSX.Element>,
  locale: string
): Promise<Graph> {
  const { container } = render(await Page({ params: Promise.resolve({ locale }) }));
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML) as Graph;
}

describe('JSON-LD en páginas institucionales', () => {
  for (const { name, component: Page, esTitle } of pages) {
    it(`/${name} emite WebPage + BreadcrumbList en español`, async () => {
      const graph = await renderGraph(Page, 'es');
      const webPage = graph['@graph'].find((node) => node['@type'] === 'WebPage');
      const breadcrumb = graph['@graph'].find((node) => node['@type'] === 'BreadcrumbList');

      expect(webPage).toMatchObject({
        url: `${SITE_URL}/es/${name}`,
        name: esTitle,
        inLanguage: 'es',
      });
      expect(breadcrumb).toBeDefined();
      const items = breadcrumb!.itemListElement as Node[];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ name: 'Inicio', item: `${SITE_URL}/es` });
      expect(items[1]).toMatchObject({ name: esTitle, item: `${SITE_URL}/es/${name}` });
    });
  }

  it('/about emite la URL en inglés sin duplicar el prefijo de idioma', async () => {
    const graph = await renderGraph(AboutPage, 'en');
    const webPage = graph['@graph'].find((node) => node['@type'] === 'WebPage');

    expect(webPage).toMatchObject({
      url: `${SITE_URL}/en/about`,
      name: 'About QuizVerse',
      inLanguage: 'en',
    });
  });
});
