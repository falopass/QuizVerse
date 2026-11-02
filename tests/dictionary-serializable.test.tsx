/**
 * Regresión del incidente de #348 (revertido en #362): el diccionario llevaba
 * funciones (`notifications.unread`, `commentBody`, …) y el layout de
 * [locale] lo pasa entero a <SiteShell> ('use client'). Las props que cruzan
 * la frontera RSC→cliente deben serializarse; una función tiraba un 500 en
 * todas las rutas localizadas.
 *
 * Aquí se garantiza que getDictionary() solo devuelve datos JSON: si alguien
 * vuelve a colar una función, un Date, un Map o un undefined, este test
 * falla antes de llegar a producción.
 */

import React from 'react';
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

import { SiteShell } from '@/components/layout/site-shell';
import { getDictionary, locales, type Dictionary } from '@/lib/i18n/dictionaries';

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
  }

  it('SiteShell renderiza con el diccionario serializado, tal como llega por RSC', async () => {
    const fromRsc = JSON.parse(JSON.stringify(await getDictionary('es'))) as Dictionary;
    render(
      <SiteShell locale="es" dictionary={fromRsc} categorySlugs={[]}>
        <p>contenido</p>
      </SiteShell>
    );

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/es/privacy');
  });
});
