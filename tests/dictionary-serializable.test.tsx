/**
 * Regresión del incidente de #348 (revertido en #362): el diccionario llevaba
 * funciones (`notifications.unread`, `commentBody`, …) y las props que cruzan
 * la frontera RSC→cliente deben serializarse; una función tiraba un 500 en
 * todas las rutas localizadas.
 *
 * Aquí se garantiza que tanto getDictionary() como extractNavLabels() solo
 * devuelven datos JSON serializables y que SiteShell renderiza con navLabels
 * serializados y Footer renderizado en servidor como slot.
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/es',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

import { Footer } from '@/components/layout/footer';
import { extractNavLabels, type NavLabels } from '@/components/layout/floating-nav';
import { SiteShell } from '@/components/layout/site-shell';
import { getDictionary, locales } from '@/lib/i18n/dictionaries';

/** Rutas de los valores que JSON.stringify no puede representar tal cual. */
function nonSerializablePaths(value: unknown, path = 'dictionary'): string[] {
  if (value === null) return [];
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return [];
    case 'number':
      return Number.isFinite(value) ? [] : [`${path} (${String(value)})`];
    case 'object': {
      if (Array.isArray(value)) {
        return value.flatMap((item, index) => nonSerializablePaths(item, `${path}[${index}]`));
      }
      // Date, Map, Set y demás clases serializan mal aunque sean "objetos".
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        return [`${path} (${(value as object).constructor.name})`];
      }
      return Object.entries(value).flatMap(([key, item]) =>
        nonSerializablePaths(item, `${path}.${key}`)
      );
    }
    // function, undefined, symbol, bigint: se pierden o rompen al serializar.
    default:
      return [`${path} (${typeof value})`];
  }
}

describe('diccionario serializable (regresión del 500 de #348)', () => {
  for (const locale of locales) {
    it(`getDictionary('${locale}') solo contiene valores serializables a JSON`, async () => {
      const dictionary = await getDictionary(locale);
      expect(nonSerializablePaths(dictionary)).toEqual([]);
    });

    it(`getDictionary('${locale}') sobrevive ida y vuelta por JSON sin pérdida`, async () => {
      const dictionary = await getDictionary(locale);
      expect(JSON.parse(JSON.stringify(dictionary))).toEqual(dictionary);
    });

    it(`extractNavLabels('${locale}') devuelve solo strings planos serializables`, async () => {
      const dictionary = await getDictionary(locale);
      const navLabels = extractNavLabels(dictionary, locale);
      expect(nonSerializablePaths(navLabels, 'navLabels')).toEqual([]);
      expect(JSON.parse(JSON.stringify(navLabels))).toEqual(navLabels);
    });

    it(`vocabulario unificado en '${locale}': el azar se llama igual en barra y menú`, async () => {
      const dictionary = await getDictionary(locale);
      const navLabels = extractNavLabels(dictionary, locale);
      expect(navLabels.randomQuiz).toBe(navLabels.mobileRandomQuiz);
      expect(navLabels.personality).toBe(dictionary.nav.personality);
      expect(navLabels.trivia).toBe(dictionary.nav.trivia);
    });
  }

  it('SiteShell renderiza con navLabels serializados y Footer en slot de servidor', async () => {
    const dictionary = await getDictionary('es');
    const navLabels = JSON.parse(JSON.stringify(extractNavLabels(dictionary, 'es'))) as NavLabels;
    render(
      <SiteShell
        locale="es"
        navLabels={navLabels}
        footer={<Footer dictionary={dictionary} locale="es" categorySlugs={[]} />}
      >
        <p>contenido</p>
      </SiteShell>
    );

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/es/privacy');
  });

  it('el shell cliente y sus componentes no importan dictionaries.ts ni Footer en runtime (D-04)', () => {
    const clientFiles = [
      'components/layout/site-shell.tsx',
      'components/layout/floating-nav.tsx',
      'components/home/quick-start-deck.tsx',
      'components/layout/notification-bell.tsx',
      'components/layout/user-menu.tsx',
      'components/notifications/notification-list.tsx',
      'components/quiz/my-quizzes-list.tsx',
      'components/ui/modal.tsx',
      'components/ui/toast.tsx',
      'app/error.tsx',
      'app/[locale]/error.tsx',
    ];
    for (const rel of clientFiles) {
      const source = readFileSync(join(__dirname, '..', 'src', rel), 'utf8');
      expect(source, `${rel} no debe importar dictionaries en runtime`).not.toMatch(
        /^import\s+(?!type\b)[^;\n]*from\s+['"]@\/lib\/i18n\/dictionaries['"]/m
      );
      expect(source, `${rel} no debe importar catalog en runtime`).not.toMatch(
        /^import\s+(?!type\b)[^;\n]*from\s+['"]@\/lib\/i18n\/catalog['"]/m
      );
    }
    const shellSource = readFileSync(
      join(__dirname, '..', 'src', 'components/layout/site-shell.tsx'),
      'utf8'
    );
    expect(shellSource).not.toMatch(/from\s+['"]\.\/footer['"]/);
  });
});
