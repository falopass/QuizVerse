#!/usr/bin/env node
/**
 * Regenerates src/lib/data/quiz-locale-map.ts from the versioned seeds — the
 * en↔es pairs that feed hreflang, the sitemap alternates and the locale
 * switcher.
 *
 *   node scripts/seo/emit-locale-map.mjs           # dry-run: counts + skipped
 *   node scripts/seo/emit-locale-map.mjs --write   # rewrite the map (npm run seo:locale-map)
 *
 * Sources:
 *   - generated/trending-seed*.normalized.json — pairs share one `source_id`
 *   - scripts/seed/editorial-seed-*.json — each quiz sits next to its
 *     translated pair (en/es or es/en; batch 2026ak alternates the order)
 *
 * A pair only enters the map when it is unambiguous (exactly one en and one es
 * slug, both with the right prefix, claimed by no other slug). Ambiguous
 * groups are reported and left out: a missing hreflang is better than a wrong
 * one. Output is deterministic — pairs are sorted by en slug.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP_PATH = join(ROOT, 'src', 'lib', 'data', 'quiz-locale-map.ts');
const PRINT_WIDTH = 100; // prettier.config.js — keep the generated file stable

/**
 * Pairs inside a trending seed: quizzes that share one `source_id` are the two
 * language versions of the same quiz. Anything that is not exactly one en +
 * one es is skipped as ambiguous.
 */
export function collectTrendingPairs(quizzes, source) {
  const groups = new Map();
  for (const quiz of quizzes) {
    const key = quiz.source_id ?? `__sin-source_id__${quiz.slug}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(quiz);
  }
  const pairs = [];
  const skipped = [];
  for (const [sourceId, group] of groups) {
    const en = group.filter((quiz) => quiz.language === 'en');
    const es = group.filter((quiz) => quiz.language === 'es');
    if (group.length === 2 && en.length === 1 && es.length === 1) {
      pairs.push({ en: en[0].slug, es: es[0].slug, source });
    } else {
      skipped.push({
        source,
        reason: `source_id ${sourceId}: ${group
          .map((quiz) => `${quiz.language}:${quiz.slug}`)
          .join(', ')}`,
      });
    }
  }
  return { pairs, skipped };
}

/**
 * Pairs inside an editorial seed: consecutive quizzes with different languages
 * are a translated pair (the pair order may be es/en, e.g. batch 2026ak).
 * A quiz left without an adjacent counterpart is skipped as ambiguous.
 */
export function collectEditorialPairs(quizzes, source) {
  const pairs = [];
  const skipped = [];
  let pending = null;
  const flush = () => {
    if (pending) {
      skipped.push({
        source,
        reason: `sin pareja adyacente: ${pending.language}:${pending.slug}`,
      });
      pending = null;
    }
  };
  for (const quiz of quizzes) {
    if (!pending) {
      pending = quiz;
      continue;
    }
    if (pending.language !== quiz.language) {
      const [en, es] = pending.language === 'en' ? [pending, quiz] : [quiz, pending];
      pairs.push({ en: en.slug, es: es.slug, source });
      pending = null;
    } else {
      flush();
      pending = quiz;
    }
  }
  flush();
  return { pairs, skipped };
}

/**
 * Merges pair candidates from every seed into the final sorted list. A slug
 * claimed by two different partners is ambiguous: both claims are dropped.
 */
export function mergePairs(candidates) {
  const claims = new Map(); // en slug -> Map(es slug -> sources)
  const skipped = [];
  for (const { en, es, source } of candidates) {
    if (!en.startsWith('en-') || !es.startsWith('es-')) {
      skipped.push({ source, reason: `prefijos inválidos: ${en} -> ${es}` });
      continue;
    }
    if (!claims.has(en)) claims.set(en, new Map());
    const targets = claims.get(en);
    if (!targets.has(es)) targets.set(es, []);
    targets.get(es).push(source);
  }

  const pairs = [];
  const claimedEs = new Map(); // es slug -> en slug
  for (const [en, targets] of claims) {
    if (targets.size > 1) {
      skipped.push({
        source: [...targets.values()].flat().join(', '),
        reason: `${en} reclama ${targets.size} parejas distintas: ${[...targets.keys()].join(', ')}`,
      });
      continue;
    }
    const [es, sources] = [...targets.entries()][0];
    if (claimedEs.has(es)) {
      skipped.push({
        source: sources.join(', '),
        reason: `${es} reclamado tanto por ${claimedEs.get(es)} como por ${en}`,
      });
      continue;
    }
    claimedEs.set(es, en);
    pairs.push({ en, es, source: sources.join(', ') });
  }
  pairs.sort((a, b) => (a.en < b.en ? -1 : a.en > b.en ? 1 : 0));
  return { pairs, skipped };
}

/** Reads every versioned seed under `root` and returns { pairs, skipped }. */
export function collectLocalePairs(root = ROOT) {
  const candidates = [];
  const skipped = [];

  const seedDir = join(root, 'scripts', 'seed');
  for (const file of readdirSync(seedDir)
    .filter((name) => /^editorial-seed.*\.json$/.test(name))
    .sort()) {
    const { quizzes = [] } = JSON.parse(readFileSync(join(seedDir, file), 'utf8'));
    const result = collectEditorialPairs(quizzes, `scripts/seed/${file}`);
    candidates.push(...result.pairs);
    skipped.push(...result.skipped);
  }

  const generatedDir = join(root, 'generated');
  for (const file of readdirSync(generatedDir)
    .filter((name) => /^trending-seed.*\.normalized\.json$/.test(name))
    .sort()) {
    const data = JSON.parse(readFileSync(join(generatedDir, file), 'utf8'));
    const quizzes = Array.isArray(data) ? data : (data.quizzes ?? []);
    const result = collectTrendingPairs(quizzes, `generated/${file}`);
    candidates.push(...result.pairs);
    skipped.push(...result.skipped);
  }

  const merged = mergePairs(candidates);
  return { pairs: merged.pairs, skipped: [...skipped, ...merged.skipped] };
}

/** Renders the TypeScript source of quiz-locale-map.ts. */
export function renderLocaleMap(pairs) {
  const lines = pairs.map(({ en, es }) => {
    const line = `  '${en}': '${es}',`;
    return line.length <= PRINT_WIDTH ? line : `  '${en}':\n    '${es}',`;
  });
  return `// Mapa de pares en↔es de los quizzes publicados en los seeds versionados.
// Generado por scripts/seo/emit-locale-map.mjs (npm run seo:locale-map); no editar a mano.
// Alimenta el hreflang de las fichas, los alternates del sitemap y el cambio de idioma.
const EN_TO_ES: Record<string, string> = {
${lines.join('\n')}
};

const ES_TO_EN = Object.fromEntries(Object.entries(EN_TO_ES).map(([en, es]) => [es, en]));

export function getEquivalentQuizSlug(slug: string, targetLocale: 'en' | 'es'): string | null {
  return (targetLocale === 'es' ? EN_TO_ES : ES_TO_EN)[slug] ?? null;
}
`;
}

function main() {
  const write = process.argv.includes('--write');
  const { pairs, skipped } = collectLocalePairs(ROOT);

  for (const { source, reason } of skipped) {
    console.warn(`omitido (${source}): ${reason}`);
  }

  if (write) {
    writeFileSync(MAP_PATH, renderLocaleMap(pairs));
    console.log(`${MAP_PATH} regenerado`);
  } else {
    console.log('dry-run: usa --write para regenerar el mapa');
  }
  console.log(
    `RESULTADO: ${pairs.length} pares en↔es derivados, ${skipped.length} omitidos por ambiguos`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
