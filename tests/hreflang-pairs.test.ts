import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

// Cada par de quiz-locale-map.ts debe apuntar a un slug que existe en el corpus
// de seeds, tener el prefijo del otro idioma y devolver el slug original al
// preguntar en sentido inverso. Si no, se publica un hreflang hacia un 404.

const ROOT = join(__dirname, '..');
const SEED_DIR = join(ROOT, 'scripts', 'seed');
const TRENDING = join(ROOT, 'generated', 'trending-seed.normalized.json');

type Locale = 'en' | 'es';
type Resolver = (slug: string, targetLocale: Locale) => string | null;

function loadCorpusSlugs(): Set<string> {
  const slugs = new Set<string>();
  const add = (quiz: { slug?: unknown }) => {
    if (typeof quiz.slug === 'string') slugs.add(quiz.slug);
  };

  for (const file of readdirSync(SEED_DIR)) {
    if (!/^editorial-seed.*\.json$/.test(file)) continue;
    const data = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')) as {
      quizzes?: Array<{ slug?: unknown }>;
    };
    for (const quiz of data.quizzes ?? []) add(quiz);
  }

  const trending = JSON.parse(readFileSync(TRENDING, 'utf8')) as Array<{ slug?: unknown }>;
  for (const quiz of trending) add(quiz);

  return slugs;
}

// Recorre el corpus en ambos sentidos y devuelve TODOS los pares rotos,
// con el slug de origen, el destino y la condición que incumple.
export function findBrokenPairs(resolve: Resolver, corpus: Set<string>): string[] {
  const errors: string[] = [];
  const directions: Array<[Locale, Locale]> = [
    ['en', 'es'],
    ['es', 'en'],
  ];

  for (const [from, to] of directions) {
    for (const slug of corpus) {
      if (!slug.startsWith(`${from}-`)) continue;
      const pair = resolve(slug, to);
      if (pair === null) continue;

      const problems: string[] = [];
      if (pair === slug) problems.push('apunta a sí mismo');
      if (!pair.startsWith(`${to}-`)) problems.push(`no empieza por '${to}-'`);
      if (!corpus.has(pair)) problems.push('no existe en el corpus de seeds');
      else if (resolve(pair, from) !== slug) problems.push('no devuelve el par inverso');

      for (const problem of problems) {
        errors.push(`${slug} -> ${pair}: ${problem}`);
      }
    }
  }

  return errors;
}

describe('hreflang pairs (quiz-locale-map vs corpus de seeds)', () => {
  const corpus = loadCorpusSlugs();

  it('el corpus de seeds no está vacío', () => {
    expect(corpus.size).toBeGreaterThan(0);
  });

  it('todo par del mapa existe en el corpus, tiene prefijo del otro idioma y vuelve', () => {
    const errors = findBrokenPairs(getEquivalentQuizSlug, corpus);
    expect(errors, `pares rotos:\n${errors.join('\n')}`).toEqual([]);
  });

  it('control: detecta un par roto en un mapa falso', () => {
    const fakeCorpus = new Set(['en-a', 'es-a', 'en-b', 'es-c']);
    // Lookup plano en ambas direcciones, como haría el mapa real ya invertido.
    const fakeLookup: Record<string, string> = {
      'en-a': 'es-a',
      'es-a': 'en-a', // par correcto
      'en-b': 'en-b', // se apunta a sí mismo
      'es-c': 'en-z', // destino inexistente
      'en-d': 'es-x', // origen fuera del corpus: no se evalúa
    };
    const fakeResolver: Resolver = (slug) => fakeLookup[slug] ?? null;

    const errors = findBrokenPairs(fakeResolver, fakeCorpus);

    expect(errors).toEqual([
      'en-b -> en-b: apunta a sí mismo',
      "en-b -> en-b: no empieza por 'es-'",
      'es-c -> en-z: no existe en el corpus de seeds',
    ]);
    expect(errors.some((e) => e.startsWith('en-a'))).toBe(false);
    expect(errors.some((e) => e.startsWith('en-d'))).toBe(false);
  });
});
