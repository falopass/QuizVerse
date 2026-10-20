import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

// Cada par de quiz-locale-map.ts debe apuntar a un slug que existe en el corpus
// de seeds, tener el prefijo del otro idioma y devolver el slug original al
// preguntar en sentido inverso. Si no, se publica un hreflang hacia un 404.
// Las entradas del mapa se leen del propio archivo fuente porque el módulo
// solo exporta getEquivalentQuizSlug() y no las tablas.

const ROOT = join(__dirname, '..');
const SEED_DIR = join(ROOT, 'scripts', 'seed');
const TRENDING = join(ROOT, 'generated', 'trending-seed.normalized.json');
const LOCALE_MAP = join(ROOT, 'src', 'lib', 'data', 'quiz-locale-map.ts');

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

// Extrae los pares 'en-*': 'es-*' literales de EN_TO_ES en el archivo fuente.
function loadMapPairs(): Array<[string, string]> {
  const source = readFileSync(LOCALE_MAP, 'utf8');
  return [...source.matchAll(/'((?:en|es)-[^']+)':\s*'((?:en|es)-[^']+)'/g)].map(
    (m) => [m[1], m[2]] as [string, string]
  );
}

// Recorre TODAS las entradas del mapa y devuelve TODOS los pares rotos,
// con el slug de origen, el destino y la condición que incumple.
export function findBrokenPairs(
  pairs: Array<[string, string]>,
  resolve: Resolver,
  corpus: Set<string>
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const [src, dst] of pairs) {
    if (seen.has(src)) {
      errors.push(`${src} -> ${dst}: origen duplicado en el mapa`);
      continue;
    }
    seen.add(src);

    const from: Locale | null = src.startsWith('en-') ? 'en' : src.startsWith('es-') ? 'es' : null;
    const to: Locale | null = from === 'en' ? 'es' : from === 'es' ? 'en' : null;

    const problems: string[] = [];
    if (from === null) problems.push("el origen no empieza por 'en-' ni 'es-'");
    if (!corpus.has(src)) problems.push('el origen no existe en el corpus de seeds');
    if (dst === src) problems.push('apunta a sí mismo');
    if (to !== null && !dst.startsWith(`${to}-`)) problems.push(`no empieza por '${to}-'`);
    if (!corpus.has(dst)) problems.push('el destino no existe en el corpus de seeds');
    if (from !== null && resolve(dst, from) !== src) {
      problems.push('no devuelve el par inverso');
    }

    for (const problem of problems) {
      errors.push(`${src} -> ${dst}: ${problem}`);
    }
  }

  return errors;
}

describe('hreflang pairs (quiz-locale-map vs corpus de seeds)', () => {
  const corpus = loadCorpusSlugs();
  const mapPairs = loadMapPairs();

  it('el corpus de seeds y el mapa no están vacíos', () => {
    expect(corpus.size).toBeGreaterThan(0);
    expect(mapPairs.length).toBeGreaterThan(0);
  });

  it('todo par del mapa existe en el corpus, tiene prefijo del otro idioma y vuelve', () => {
    const errors = findBrokenPairs(mapPairs, getEquivalentQuizSlug, corpus);
    expect(errors, `pares rotos:\n${errors.join('\n')}`).toEqual([]);
  });

  it('control: detecta un par roto en un mapa falso', () => {
    const fakeCorpus = new Set(['en-a', 'es-a', 'en-b', 'es-c']);
    const fakePairs: Array<[string, string]> = [
      ['en-a', 'es-a'], // par correcto
      ['en-b', 'en-b'], // se apunta a sí mismo
      ['es-c', 'en-z'], // destino inexistente
      ['en-d', 'es-x'], // origen y destino fuera del corpus
    ];
    // Lookup plano en ambas direcciones, como haría el mapa real ya invertido.
    const fakeLookup: Record<string, string> = {
      'en-a': 'es-a',
      'es-a': 'en-a',
      'en-b': 'en-b',
      'es-c': 'en-z',
      'en-z': 'es-c',
      'en-d': 'es-x',
      'es-x': 'en-d',
    };
    const fakeResolver: Resolver = (slug) => fakeLookup[slug] ?? null;

    const errors = findBrokenPairs(fakePairs, fakeResolver, fakeCorpus);

    expect(errors).toEqual([
      'en-b -> en-b: apunta a sí mismo',
      "en-b -> en-b: no empieza por 'es-'",
      'es-c -> en-z: el destino no existe en el corpus de seeds',
      'en-d -> es-x: el origen no existe en el corpus de seeds',
      'en-d -> es-x: el destino no existe en el corpus de seeds',
    ]);
  });
});
