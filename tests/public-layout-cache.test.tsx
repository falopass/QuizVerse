import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({
  cookies: vi.fn(() => {
    throw new Error('cookies during public render');
  }),
  headers: vi.fn(() => {
    throw new Error('headers during public render');
  }),
}));
vi.mock('next/headers', () => request);
vi.mock('next/font/google', () => ({
  Archivo_Black: () => ({ variable: '--font-archivo' }),
  Space_Grotesk: () => ({ variable: '--font-space' }),
}));
vi.mock('@/lib/data/category-counts', () => ({
  getPopulatedCategorySlugs: async () => new Set(['trivia']),
}));

import LocaleLayout, { generateStaticParams, revalidate } from '@/app/[locale]/layout';
import EmbedLayout from '@/app/embed/[locale]/layout';
import { SiteDocument } from '@/components/layout/site-document';
import { CATALOG_REVALIDATE_SECONDS } from '@/lib/data/cache-tags';

describe('documento público cacheable', () => {
  it.each(['en', 'es'])(
    'resuelve el HTML %s desde params sin acceder a la petición',
    async (locale) => {
      const tree = await LocaleLayout({
        children: <p>public</p>,
        params: Promise.resolve({ locale }),
      });
      expect(tree.type).toBe(SiteDocument);
      expect(SiteDocument(tree.props).props.lang).toBe(locale);
      expect(tree.props.children.props.dictionary).toEqual(
        JSON.parse(JSON.stringify(tree.props.children.props.dictionary))
      );
      expect(request.cookies).not.toHaveBeenCalled();
      expect(request.headers).not.toHaveBeenCalled();
    }
  );

  it('conserva idioma y documento completo en embed sin SiteShell', async () => {
    const tree = await EmbedLayout({
      children: <p>embed</p>,
      params: Promise.resolve({ locale: 'es' }),
    });
    expect(tree.type).toBe(SiteDocument);
    const document = SiteDocument(tree.props);
    expect(document.type).toBe('html');
    expect(document.props.lang).toBe('es');
    expect(document.props.children.type).toBe('body');
  });

  it('mantiene ISR de 300s y los dos idiomas sin dependencias de request en los layouts', async () => {
    expect(revalidate).toBe(CATALOG_REVALIDATE_SECONDS);
    expect(await generateStaticParams()).toEqual([{ locale: 'en' }, { locale: 'es' }]);
    for (const file of [
      'app/[locale]/layout.tsx',
      'app/embed/[locale]/layout.tsx',
      'components/layout/site-document.tsx',
    ]) {
      const source = readFileSync(join(__dirname, '../src', file), 'utf8');
      expect(source).not.toMatch(/from ['"]next\/headers['"]|\b(?:cookies|headers)\s*\(/);
    }
  });
});
