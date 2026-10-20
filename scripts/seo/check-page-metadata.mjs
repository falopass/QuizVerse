#!/usr/bin/env node
/**
 * Page-metadata guard — catches a new App Router page that ships without its
 * own metadata (it would silently inherit the root canonical/title) and a
 * private route that forgets `noindex`.
 *
 *   node scripts/seo/check-page-metadata.mjs [--root <dir>] [--json]
 *
 * Rules (blocking, exit 1):
 *   - every src/app/[locale]/page.tsx must mention `generateMetadata`
 *     or `export const metadata`
 *   - private routes (login, register, create, play, result, profile,
 *     settings, notifications, forgot-password, reset-password) must
 *     declare `noindex` or delegate to a whitelisted helper
 *     (`generateProfileMetadata`)
 *
 * Excluded: src/app/api/**, opengraph-image.tsx, sitemap.ts, robots.ts.
 * Node stdlib only.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const PRIVATE_PREFIXES = [
  'src/app/[locale]/login/',
  'src/app/[locale]/register/',
  'src/app/[locale]/create/',
  'src/app/[locale]/quiz/[slug]/play/',
  'src/app/[locale]/quiz/[slug]/result/',
  'src/app/[locale]/profile/',
  'src/app/[locale]/settings/',
  'src/app/[locale]/notifications/',
  'src/app/[locale]/forgot-password/',
  'src/app/[locale]/reset-password/',
];

const NOINDEX_HELPERS = ['generateProfileMetadata'];

function parseArgs(argv) {
  const args = { root: REPO_ROOT, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') {
      args.root = argv[++i];
    } else if (argv[i] === '--json') {
      args.json = true;
    }
  }
  return args;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function toPosix(path) {
  return path.split(sep).join('/');
}

export function findProblems(root) {
  const appDir = join(root, 'src', 'app');
  const pages = walk(appDir)
    .map((f) => toPosix(relative(root, f)))
    .filter((rel) => {
      if (!rel.endsWith('/page.tsx')) return false;
      if (rel.startsWith('src/app/api/')) return false;
      return true;
    })
    .sort();

  const problems = [];
  for (const rel of pages) {
    const src = readFileSync(join(root, rel), 'utf8');
    if (rel.startsWith('src/app/[locale]/')) {
      if (!src.includes('generateMetadata') && !src.includes('export const metadata')) {
        problems.push({
          file: rel,
          reason: 'sin metadata propia (falta generateMetadata o export const metadata)',
        });
      }
    }
    if (PRIVATE_PREFIXES.some((p) => rel.startsWith(p))) {
      if (!src.includes('noindex') && !NOINDEX_HELPERS.some((h) => src.includes(h))) {
        problems.push({
          file: rel,
          reason: 'ruta privada sin noindex ni helper de la lista blanca',
        });
      }
    }
  }
  return { pages: pages.length, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { root, json } = parseArgs(process.argv.slice(2));
  const { pages, problems } = findProblems(root);
  if (json) {
    console.log(JSON.stringify({ pages, problems }, null, 2));
  } else {
    for (const p of problems) console.log(`${p.file}: ${p.reason}`);
    console.log(`RESULTADO: ${pages} páginas revisadas, ${problems.length} problemas`);
  }
  process.exit(problems.length === 0 ? 0 : 1);
}
