/**
 * Auditoría de enlaces internos — qué páginas del sitemap quedaron huérfanas
 * (0 enlaces entrantes desde otras páginas del sitio) o con un solo enlace
 * entrante: las que Google puede rastrear pero el sitio nunca descubre.
 *
 *   node scripts/seo/internal-links.mjs --sitemap https://quizverse.org/sitemap.xml
 *   node scripts/seo/internal-links.mjs --input fixtures/html --base https://quizverse.org
 *   node scripts/seo/internal-links.mjs --sitemap <url> --json --fail-on-orphans
 *
 * --input lee los *.html de un directorio local y les asigna la URL por nombre
 *   de archivo (en/quiz.html → /en/quiz, index.html → /) para probar sin red.
 * --fail-on-orphans sale con código 1 si hay huérfanas; por defecto sale 0:
 *   es un informe, no un gate.
 *
 * Solo lectura: GETs públicos, sin cabeceras de auth ni escrituras.
 * Salida: 0 informe OK · 1 huérfanas con --fail-on-orphans · 2 uso o red.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE = 'https://quizverse.org';
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'quizverse-internal-links/1.0';

const USAGE = `uso: node scripts/seo/internal-links.mjs (--sitemap <url> | --input <dir>) [opciones]

  --sitemap <url>     descarga el sitemap y audita cada <loc> (concurrencia 4, timeout 15s)
  --input <dir>       lee los *.html del directorio; la URL sale del nombre
                      (index.html → /, en/quiz.html → /en/quiz)
  --base <origen>     origen del sitio para --input (por defecto ${DEFAULT_BASE})
  --json              imprime además el informe completo como JSON
  --fail-on-orphans   sale con código 1 si hay páginas huérfanas (por defecto: 0)
  --help              muestra esta ayuda`;

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Valor de un atributo HTML: comillas dobles, simples o sin comillas. */
function attrValue(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? null : decodeEntities(value);
}

/** <loc> absolutos de un urlset o sitemapindex, deduplicados. */
export function parseSitemap(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) {
    const loc = decodeEntities(match[1].trim());
    if (/^https?:\/\//.test(loc) && !urls.includes(loc)) urls.push(loc);
  }
  return urls;
}

/** Clave de página en el grafo: origen + path sin barra final, query ni hash. */
function normalizePageUrl(raw) {
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.origin}${path}`;
  } catch {
    return raw;
  }
}

function toPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function normalizeHref(href, pageUrl, origin) {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  let url;
  try {
    url = new URL(trimmed, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== origin) return null;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/api' || path.startsWith('/api/')) return null;
  return `${url.origin}${path}`;
}

/**
 * Enlaces internos de un documento: cada <a href> resuelto contra pageUrl,
 * normalizado (sin hash, sin query, sin barra final) y deduplicado, en orden
 * de aparición. Descarta mailto/tel/javascript/data, anclas, otros orígenes y
 * /api/. Incluye el self-link si la página se enlaza a sí misma.
 */
export function extractInternalLinks(html, pageUrl, siteOrigin) {
  const origin = new URL(siteOrigin).origin;
  const links = new Set();
  for (const match of html.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const href = attrValue(match[0], 'href');
    if (href === null) continue;
    const normalized = normalizeHref(href, pageUrl, origin);
    if (normalized) links.add(normalized);
  }
  return [...links];
}

/**
 * Grafo de enlaces internos sobre `pages` ({ url, html } o { url, error }).
 * Un enlace entrante es una página distinta que la enlaza: ni self-loops ni
 * varios <a> desde la misma página suman más de uno.
 */
export function buildReport(pages, siteOrigin) {
  const origin = new URL(siteOrigin).origin;
  const byUrl = new Map();
  for (const page of pages) {
    const url = normalizePageUrl(page.url);
    if (!byUrl.has(url)) byUrl.set(url, page);
  }

  const inbound = new Map([...byUrl.keys()].map((url) => [url, new Set()]));
  const errors = [];
  let linksOutsideSitemap = 0;
  for (const [source, page] of byUrl) {
    if (page.error) {
      errors.push({ url: source, error: String(page.error) });
      continue;
    }
    for (const target of extractInternalLinks(page.html ?? '', source, origin)) {
      if (target === source) continue;
      if (!inbound.has(target)) {
        linksOutsideSitemap += 1;
        continue;
      }
      inbound.get(target).add(source);
    }
  }

  const orphans = [...byUrl.keys()].filter((url) => inbound.get(url).size === 0);
  const singleInbound = [...byUrl.keys()]
    .filter((url) => inbound.get(url).size === 1)
    .map((url) => ({ path: toPath(url), from: toPath([...inbound.get(url)][0]) }));
  const topLinked = [...inbound.entries()]
    .map(([url, sources]) => ({ path: toPath(url), count: sources.size }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, 10);

  return {
    origin,
    total: byUrl.size,
    errorCount: errors.length,
    errors: errors.map(({ url, error }) => ({ path: toPath(url), error })),
    orphans: orphans.map(toPath),
    singleInbound,
    topLinked,
    linksOutsideSitemap,
  };
}

function printReport(report) {
  console.log(`\n${report.total} urls auditadas · ${report.errorCount} error(es) de fetch`);
  if (report.errors.length > 0) {
    for (const { path, error } of report.errors) console.log(`  error ${path} — ${error}`);
  }
  console.log(`\nHuérfanas (0 enlaces entrantes): ${report.orphans.length}`);
  for (const path of report.orphans) console.log(`  ${path}`);
  console.log(`\nCon un solo enlace entrante: ${report.singleInbound.length}`);
  for (const { path, from } of report.singleInbound) console.log(`  ${path}  ← ${from}`);
  console.log('\nMás enlazadas (top 10):');
  for (const { path, count } of report.topLinked) {
    console.log(`  ${String(count).padStart(5)}  ${path}`);
  }
  if (report.linksOutsideSitemap > 0) {
    console.log(`\nEnlaces a URLs internas fuera del sitemap: ${report.linksOutsideSitemap}`);
  }
}

function parseArgs(argv) {
  const args = {
    sitemap: null,
    input: null,
    base: null,
    json: false,
    failOnOrphans: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--sitemap') args.sitemap = argv[++i];
    else if (arg === '--input') args.input = argv[++i];
    else if (arg === '--base') args.base = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--fail-on-orphans') args.failOnOrphans = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`opción desconocida: ${arg}`);
  }
  return args;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return response.text();
}

async function loadSitemapUrls(sitemapUrl) {
  let locs = parseSitemap(await fetchText(sitemapUrl));
  // Si el documento es un sitemapindex, los <loc> son sub-sitemaps: un nivel más.
  if (locs.length > 0 && locs.every((loc) => loc.endsWith('.xml'))) {
    const nested = await mapPool(locs, CONCURRENCY, async (url) => {
      try {
        return parseSitemap(await fetchText(url));
      } catch {
        return [];
      }
    });
    locs = nested.flat();
  }
  return locs;
}

function fileToPath(rel) {
  const withoutExt = rel.replace(/\.html$/i, '').replace(/\\/g, '/');
  const withoutIndex = withoutExt === 'index' ? '' : withoutExt.replace(/\/index$/, '');
  return `/${withoutIndex}`;
}

async function collectHtmlFiles(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(join(dir, entry.name), rel)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(rel);
    }
  }
  return files.sort();
}

async function readInputPages(dir, siteOrigin) {
  const pages = [];
  for (const rel of await collectHtmlFiles(dir)) {
    const html = await readFile(join(dir, rel), 'utf8');
    pages.push({ url: `${siteOrigin}${fileToPath(rel)}`, html });
  }
  return pages;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (args.sitemap && args.input) throw new Error('--sitemap y --input son excluyentes');
  if (!args.sitemap && !args.input) throw new Error('falta --sitemap <url> o --input <dir>');

  const siteOrigin = args.base
    ? new URL(args.base).origin
    : args.sitemap
      ? new URL(args.sitemap).origin
      : DEFAULT_BASE;

  let pages;
  if (args.input) {
    pages = await readInputPages(args.input, siteOrigin);
    if (pages.length === 0) throw new Error(`sin archivos *.html en ${args.input}`);
    console.log(`Auditando ${pages.length} páginas locales de ${args.input} (${siteOrigin})`);
  } else {
    const urls = [...new Set((await loadSitemapUrls(args.sitemap)).map(normalizePageUrl))];
    if (urls.length === 0) throw new Error(`el sitemap no tiene <loc>: ${args.sitemap}`);
    console.log(`Auditando enlaces internos de ${urls.length} urls (${args.sitemap})`);
    pages = await mapPool(urls, CONCURRENCY, async (url) => {
      let page;
      try {
        const response = await fetch(url, {
          headers: { accept: 'text/html', 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        page = response.ok
          ? { url, html: await response.text() }
          : { url, error: `HTTP ${response.status}` };
      } catch (error) {
        page = { url, error: error instanceof Error ? error.message : String(error) };
      }
      process.stdout.write('.');
      return page;
    });
  }

  const report = buildReport(pages, siteOrigin);
  printReport(report);
  if (args.json) console.log(`\n${JSON.stringify(report, null, 2)}`);
  if (args.failOnOrphans && report.orphans.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`internal-links: ${error instanceof Error ? error.message : String(error)}`);
    console.error(USAGE);
    process.exit(2);
  });
}
