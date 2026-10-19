/**
 * Live SEO audit — fetches the sitemap of a deployed instance and checks a
 * spread sample of its pages the way Google will see them: status codes,
 * canonical, hreflang, JSON-LD, title and meta description.
 *
 *   node scripts/seo/audit-live.mjs                                  # audit production
 *   node scripts/seo/audit-live.mjs --base https://preview.vercel.app
 *   node scripts/seo/audit-live.mjs --limit 80 --json report.json
 *   node scripts/seo/audit-live.mjs --sample /en/about --sample /es/faq
 *
 * The sample is distributed (locales × page types round-robin), never just the
 * first N sitemap entries. --sample adds concrete URLs on top of the sample;
 * pass a full https:// URL to keep the canonical check anchored to the public
 * URL even when --base points at a preview.
 *
 * Read-only: public GET requests only — no auth headers, no writes besides the
 * optional --json report. Exits 0 when every audited URL passes, 1 otherwise.
 */

import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE = 'https://quizverse.org';
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;
const FETCH_TIMEOUT_MS = 20_000;
const TITLE_MIN = 15;
const TITLE_MAX = 60;

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
/** Repeatable flag that also accepts comma-separated values. */
const argValues = (name) =>
  args.flatMap((arg, index) => (arg === name ? (args[index + 1] ?? '').split(',') : []));

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Value of a single or double quoted HTML attribute, or null. */
function attrValue(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, 'i'));
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? null : decodeEntities(value);
}

function linkTags(html, rel) {
  const tags = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rels = attrValue(match[0], 'rel');
    if (rels && rels.toLowerCase().split(/\s+/).includes(rel)) tags.push(match[0]);
  }
  return tags;
}

function metaContents(html, name) {
  const values = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attrValue(match[0], 'name')?.toLowerCase() === name) {
      const content = attrValue(match[0], 'content');
      if (content !== null) values.push(content);
    }
  }
  return values;
}

/** Absolute URLs compare equal ignoring a trailing slash on the path. */
function sameUrl(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.host === ub.host &&
      ua.pathname.replace(/\/+$/, '') === ub.pathname.replace(/\/+$/, '') &&
      ua.search === ub.search
    );
  } catch {
    return false;
  }
}

/** Extract the <loc> of every <url> entry, entities decoded. */
export function parseSitemap(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const loc = match[1].match(/<loc>([\s\S]*?)<\/loc>/i);
    if (loc) urls.push(decodeEntities(loc[1].trim()));
  }
  return urls;
}

function bucketKey(url) {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  const segments = path.split('/').filter(Boolean);
  const locale = segments[0] === 'es' ? 'es' : 'en';
  let type = 'page';
  if (segments[1] === 'category') type = 'category';
  else if (segments[1] === 'quiz' && segments[2]) type = 'quiz';
  return `${type}:${locale}`;
}

/**
 * Round-robin across `type:locale` buckets so a small limit still covers both
 * languages and every page kind instead of measuring only the first entries.
 */
export function sampleUrls(urls, limit) {
  const buckets = new Map();
  for (const url of urls) {
    const key = bucketKey(url);
    const bucket = buckets.get(key) ?? [];
    bucket.push(url);
    buckets.set(key, bucket);
  }
  const keys = [...buckets.keys()].sort();
  const picked = [];
  while (picked.length < limit) {
    const before = picked.length;
    for (const key of keys) {
      const bucket = buckets.get(key);
      if (bucket.length === 0) continue;
      picked.push(bucket.shift());
      if (picked.length === limit) break;
    }
    if (picked.length === before) break;
  }
  return picked;
}

/**
 * Checks a fetched page. `headers` carries the response metadata the caller
 * already saw: `{ status, location, xRobotsTag }`. A non-200 status short
 * circuits — a redirect or error body has no meaningful head to inspect.
 */
export function analyzePage(html, url, headers = {}) {
  const details = { status: headers.status ?? 200 };
  const failures = [];

  if (details.status !== 200) {
    const location = headers.location ? ` → ${headers.location}` : '';
    return { url, ok: false, failures: [`HTTP ${details.status}${location}`], details };
  }

  const robots = [...metaContents(html, 'robots'), ...metaContents(html, 'googlebot')];
  details.robots = robots;
  if (robots.some((value) => /noindex/i.test(value)) || /noindex/i.test(headers.xRobotsTag ?? '')) {
    failures.push('noindex inesperado');
  }

  const canonical = attrValue(linkTags(html, 'canonical')[0] ?? '', 'href');
  details.canonical = canonical;
  if (!canonical) failures.push('canonical ausente');
  else if (!sameUrl(canonical, url)) failures.push(`canonical cruzada → ${canonical}`);

  const alternates = linkTags(html, 'alternate').map((tag) => ({
    hreflang: attrValue(tag, 'hreflang'),
    href: attrValue(tag, 'href'),
  }));
  details.hreflang = alternates;
  if (alternates.length > 1) {
    if (!alternates.some((a) => a.href && sameUrl(a.href, canonical ?? url))) {
      failures.push('hreflang sin autorreferencia');
    }
    if (!alternates.some((a) => a.hreflang === 'x-default')) {
      failures.push('hreflang sin x-default');
    }
  }

  const ldBlocks = [
    ...html.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  details.jsonLd = ldBlocks.length;
  if (ldBlocks.length === 0) {
    failures.push('json-ld ausente');
  } else {
    for (const block of ldBlocks) {
      try {
        JSON.parse(block[1]);
      } catch {
        failures.push('json-ld inválido');
        break;
      }
    }
  }

  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  details.titleLength = title.length;
  if (!title) failures.push('sin <title>');
  else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    failures.push(`título de ${title.length} caracteres (esperados ${TITLE_MIN}-${TITLE_MAX})`);
  }

  details.description = metaContents(html, 'description')[0] ?? null;
  if (!details.description?.trim()) failures.push('meta description ausente');

  return { url, ok: failures.length === 0, failures, details };
}

function toPath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

async function fetchSitemap(base) {
  const response = await fetch(`${base}/sitemap.xml`, {
    headers: { accept: 'application/xml', 'user-agent': 'quizverse-seo-audit/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${base}/sitemap.xml (HTTP ${response.status})`);
  }
  return response.text();
}

async function main() {
  const base = (argValue('--base') || DEFAULT_BASE).replace(/\/+$/, '');
  const parsed = Number.parseInt(argValue('--limit') ?? '', 10);
  const limit = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT, MAX_LIMIT);
  const jsonFile = argValue('--json');

  const xml = await fetchSitemap(base);
  const sitemapUrls = parseSitemap(xml);
  if (sitemapUrls.length === 0) {
    throw new Error(`Sitemap at ${base}/sitemap.xml has no <loc> entries`);
  }

  // Each target pairs the public URL (what canonical must say) with the URL to
  // fetch under --base, so previews still validate against the sitemap URLs.
  const seen = new Set();
  const targets = [];
  const addTarget = (publicUrl, fetchUrl) => {
    if (seen.has(publicUrl)) return;
    seen.add(publicUrl);
    targets.push({ publicUrl, fetchUrl });
  };
  for (const loc of sampleUrls(sitemapUrls, limit)) addTarget(loc, `${base}${toPath(loc)}`);
  for (const entry of argValues('--sample')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//.test(trimmed)) {
      addTarget(trimmed, `${base}${toPath(trimmed)}`);
    } else {
      const url = `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
      addTarget(url, url);
    }
  }

  console.log(
    `Auditando ${targets.length} urls de ${base} (sitemap: ${sitemapUrls.length} urls)\n`
  );

  const results = [];
  for (const { publicUrl, fetchUrl } of targets) {
    try {
      const response = await fetch(fetchUrl, {
        redirect: 'manual',
        headers: { accept: 'text/html', 'user-agent': 'quizverse-seo-audit/1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const html = await response.text();
      results.push(
        analyzePage(html, publicUrl, {
          status: response.status,
          location: response.headers.get('location'),
          xRobotsTag: response.headers.get('x-robots-tag'),
        })
      );
    } catch (error) {
      results.push({
        url: publicUrl,
        ok: false,
        failures: [`error de red: ${error instanceof Error ? error.message : String(error)}`],
        details: {},
      });
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n\n');

  // Reciprocity: when page A declares B as hreflang alternate and B was also
  // audited, B must declare A back. Pairs outside the sample are skipped —
  // there is nothing to compare them against without extra fetches.
  for (const result of results) {
    for (const alt of result.details?.hreflang ?? []) {
      if (!alt.href) continue;
      const target = results.find((r) => r !== result && sameUrl(r.url, alt.href));
      if (!target) continue;
      const reciprocates = (target.details?.hreflang ?? []).some((a) =>
        sameUrl(a.href, result.url)
      );
      if (!reciprocates) {
        target.ok = false;
        target.failures.push(`hreflang no recíproco: no declara ${result.url}`);
      }
    }
  }

  for (const result of results) {
    console.log(
      result.ok
        ? ` ok    ${toPath(result.url)}`
        : ` falla ${toPath(result.url)} — ${result.failures.join('; ')}`
    );
  }
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length} urls · ${results.length - failed.length} ok · ${failed.length} fallas`
  );

  if (jsonFile) {
    const report = {
      base,
      checkedAt: new Date().toISOString(),
      sitemapUrls: sitemapUrls.length,
      results,
    };
    await writeFile(jsonFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Informe escrito en ${jsonFile}`);
  }

  console.log(failed.length ? `RESULTADO: ${failed.length} fallas` : 'RESULTADO: todo en verde');
  process.exitCode = failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`SEO audit failed: ${error.message}`);
    process.exit(1);
  });
}
