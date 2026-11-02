/**
 * Guard contra soft 404 (regresión del PR #314, corregida aquí).
 *
 * Un `loading.tsx` envuelve en Suspense a la página y a todo su subárbol:
 * el shell sale con status 200 antes de que la página resuelva, y un
 * `notFound()` posterior ya no puede cambiar el status — Google recibe el
 * skeleton con un 200 (soft 404).
 *
 * Reglas sobre el árbol de `src/app`:
 *  - `loading.tsx` solo puede existir en `SKELETON_ALLOWLIST`: las páginas de
 *    listado que conservan skeleton a propósito. Una página estática puede
 *    delegar el `notFound()` a un server component hijo (la ficha lo delega
 *    en `QuizDetailPage`), así que basta con que alguien añada un loading a
 *    una ruta nueva para reintroducir el soft 404 — la lista blanca lo hace
 *    un acto deliberado.
 *  - Ningún `page.tsx` bajo un segmento dinámico distinto de `[locale]` puede
 *    tener `loading.tsx` en su directorio ni en un ancestro.
 *  - Tampoco un `page.tsx` estático que llame `notFound()` por algo que no
 *    sea el guard de locale (`hasLocale`), inalcanzable en la práctica:
 *    `[locale]/layout.tsx` valida el locale antes de renderizar `children`,
 *    fuera de cualquier boundary de loading.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(__dirname, '../src/app');

// Páginas de listado con skeleton: home, explorar y leaderboard. Ninguna
// puede hacer notFound() con datos — solo el guard de locale, ya cubierto
// por `[locale]/layout.tsx` fuera del boundary.
const SKELETON_ALLOWLIST = new Set([
  join('[locale]', '(inicio)'),
  join('[locale]', 'leaderboard'),
  join('[locale]', 'quiz', '(explorar)'),
]);

function* walkFiles(dir: string, name: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full, name);
    else if (entry.name === name) yield full;
  }
}

/** Directorios que envuelven a la página: el suyo y todos los ancestros hasta src/app. */
function wrappingDirs(pageFile: string): string[] {
  const dirs = [];
  for (let dir = dirname(pageFile); dir.startsWith(APP_DIR); dir = dirname(dir)) {
    dirs.push(dir);
    if (dir === APP_DIR) break;
  }
  return dirs;
}

/** Segmentos de ruta del page.tsx relativos a src/app (sin el archivo). */
function routeSegments(pageFile: string): string[] {
  return relative(APP_DIR, pageFile).split(sep).slice(0, -1);
}

/**
 * Dinámico = puede resolverse a un recurso que no existe y hacer notFound()
 * con datos. `[locale]` queda fuera: su validez la garantiza
 * `[locale]/layout.tsx`, fuera del boundary de loading.
 */
const DYNAMIC_SEGMENT = /^\[.+\]$/;

function hasDataNotFound(pageFile: string): boolean {
  return readFileSync(pageFile, 'utf8')
    .split('\n')
    .some((line) => line.includes('notFound(') && !line.includes('hasLocale'));
}

describe('loading.tsx no envuelve páginas que pueden hacer notFound() con datos', () => {
  it('loading.tsx solo existe sobre las páginas de listado permitidas', () => {
    const problems: string[] = [];

    for (const loading of walkFiles(APP_DIR, 'loading.tsx')) {
      const rel = relative(APP_DIR, dirname(loading));
      if (!SKELETON_ALLOWLIST.has(rel)) problems.push(`${rel}/loading.tsx`);
    }

    expect(problems).toEqual([]);
  });

  it('ningún page.tsx riesgoso tiene un loading.tsx en su segmento o ancestros', () => {
    const problems: string[] = [];

    for (const page of walkFiles(APP_DIR, 'page.tsx')) {
      const dynamic = routeSegments(page).some(
        (seg) => DYNAMIC_SEGMENT.test(seg) && seg !== '[locale]'
      );
      if (!dynamic && !hasDataNotFound(page)) continue;

      const loadings = wrappingDirs(page)
        .filter((dir) => existsSync(join(dir, 'loading.tsx')))
        .map((dir) => relative(APP_DIR, dir));

      if (loadings.length > 0) {
        problems.push(
          `${relative(APP_DIR, page)} queda bajo loading.tsx en: ${loadings.join(', ')}`
        );
      }
    }

    expect(problems).toEqual([]);
  });
});
