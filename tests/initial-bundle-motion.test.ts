import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');

const RUNTIME_IMPORT = /^import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm;

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

function resolveLocal(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.json`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((candidate) => !candidate.endsWith('.css') && isFile(candidate)) ?? null;
}

function importGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(RUNTIME_IMPORT)) {
      const target = resolveLocal(file, match[1]);
      if (target) queue.push(target);
    }
  }
  return seen;
}

const graph = importGraph(join(SRC, 'app', 'layout.tsx'));

describe('bundle inicial del layout raíz', () => {
  it('recorre el toast y el banner de cookies', () => {
    expect([...graph]).toEqual(
      expect.arrayContaining([
        join(SRC, 'components', 'ui', 'toast.tsx'),
        join(SRC, 'components', 'shared', 'cookie-consent.tsx'),
      ])
    );
  });

  it('no arrastra framer-motion a ninguna página', () => {
    const offenders = [...graph].filter((file) =>
      /^import\s+(?!type\b)[^'"]*?from\s+['"]framer-motion['"]/m.test(readFileSync(file, 'utf8'))
    );

    expect(offenders).toEqual([]);
  });
});

describe('animaciones de toast y banner', () => {
  const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');

  it('viven como keyframes de CSS', () => {
    for (const name of ['toast-in', 'toast-out', 'toast-progress', 'cookie-banner-in']) {
      expect(css).toContain(`@keyframes ${name}`);
    }
  });

  it('respetan prefers-reduced-motion con la regla global del repo', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*animation-duration: 0\.01ms !important;/
    );
  });
});
