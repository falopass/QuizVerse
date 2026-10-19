/**
 * IndexNow submission — pushes every URL in the sitemap to Bing, Yandex,
 * Seznam and Naver within minutes instead of waiting for a recrawl.
 *
 *   node scripts/submit-indexnow.mjs                 # submit all sitemap URLs
 *   node scripts/submit-indexnow.mjs --dry-run       # print what would be sent
 *   node scripts/submit-indexnow.mjs --changed       # only URLs with lastmod after last run
 *   node scripts/submit-indexnow.mjs --since 2026-01-01T00:00:00Z
 *   node scripts/submit-indexnow.mjs --urls /en/quiz,/es/quiz
 *   node scripts/submit-indexnow.mjs --site https://quizverse.org
 *
 * The protocol requires a key file at the site root: public/<key>.txt must
 * contain exactly that key. This script looks for it in public/ and refuses to
 * run if the file is missing — submitting with an unreachable key file returns
 * 403 and silently teaches the search engines nothing.
 *
 * --changed keeps its state in generated/indexnow-state.json (local, gitignored).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const STATE_FILE = join(ROOT, 'generated', 'indexnow-state.json');
const KEY_PATTERN = /^[a-f0-9]{8,128}\.txt$/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const changed = args.includes('--changed');
const siteArg = args.indexOf('--site');
const urlsArg = args.indexOf('--urls');
const sinceArg = args.indexOf('--since');
const site = (
  siteArg !== -1 ? args[siteArg + 1] : process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'
).replace(/\/+$/, '');

/** IndexNow endpoints. The shared one fans out to every participating engine. */
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Parse a sitemap XML into { url, lastmod? } entries. */
export function parseSitemapEntries(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = match[1];
    const loc = block.match(/<loc>([^<]+)<\/loc>/);
    if (!loc) continue;
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    entries.push({ url: loc[1].trim(), lastmod: lastmod ? lastmod[1].trim() : undefined });
  }
  return entries;
}

/** Entries whose lastmod is a valid date strictly after `sinceIso`. */
export function changedSince(entries, sinceIso) {
  const since = Date.parse(sinceIso);
  if (Number.isNaN(since)) throw new Error(`Invalid --since date: "${sinceIso}"`);
  return entries.filter(
    (entry) =>
      entry.lastmod && !Number.isNaN(Date.parse(entry.lastmod)) && Date.parse(entry.lastmod) > since
  );
}

async function findKey() {
  const files = await readdir(PUBLIC);
  const candidates = files.filter((file) => KEY_PATTERN.test(file));
  if (candidates.length === 0) {
    throw new Error('No IndexNow key file found in public/. Expected public/<hex-key>.txt');
  }
  if (candidates.length > 1) {
    throw new Error(`Multiple candidate key files: ${candidates.join(', ')}. Keep only one.`);
  }
  const file = candidates[0];
  const key = (await readFile(join(PUBLIC, file), 'utf8')).trim();
  const expected = file.replace(/\.txt$/, '');
  if (key !== expected) {
    throw new Error(
      `Key file ${file} does not contain its own name. Content must be exactly "${expected}".`
    );
  }
  return { key, keyLocation: `${site}/${file}` };
}

async function sitemapEntries() {
  const response = await fetch(`${site}/sitemap.xml`, {
    headers: { accept: 'application/xml' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${site}/sitemap.xml (HTTP ${response.status})`);
  }
  const xml = await response.text();
  const entries = parseSitemapEntries(xml);
  if (entries.length === 0) throw new Error('Sitemap returned no <loc> entries');
  return entries;
}

async function submit(urls, key, keyLocation) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(site).host,
      key,
      keyLocation,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  // 200 = accepted, 202 = accepted but key not yet validated. Both are fine.
  const body = await response.text().catch(() => '');
  if (!response.ok && response.status !== 202) {
    throw new Error(`IndexNow rejected the batch: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
  return { status: response.status, body: body.slice(0, 200) };
}

async function main() {
  const { key, keyLocation } = await findKey();
  console.log(`IndexNow key file: ${keyLocation}`);

  let urls;
  let since;
  if (urlsArg !== -1) {
    urls = args[urlsArg + 1]
      .split(',')
      .map((path) => (path.startsWith('http') ? path : `${site}${path}`));
  } else {
    const entries = await sitemapEntries();
    if (sinceArg !== -1) {
      since = args[sinceArg + 1];
    } else if (changed) {
      const state = JSON.parse(await readFile(STATE_FILE, 'utf8').catch(() => '{}'));
      since = state.lastRun;
      if (!since) {
        console.log('No previous run recorded; submitting the full sitemap.');
      }
    }
    urls = since
      ? changedSince(entries, since).map((entry) => entry.url)
      : entries.map((e) => e.url);
  }

  if (urls.length === 0) {
    console.log(`RESULTADO: 0 urls enviadas (sin cambios desde ${since})`);
    return;
  }

  console.log(
    `Submitting ${urls.length} URLs to IndexNow (${dryRun ? 'dry run' : 'live'}${since ? `, changed since ${since}` : ''})`
  );
  if (dryRun) {
    for (const url of urls.slice(0, 10)) console.log(`  ${url}`);
    if (urls.length > 10) console.log(`  … and ${urls.length - 10} more`);
  } else {
    // IndexNow accepts up to 10.000 URLs per request; batch to keep payloads sane.
    const BATCH = 500;
    for (let index = 0; index < urls.length; index += BATCH) {
      const batch = urls.slice(index, index + BATCH);
      const result = await submit(batch, key, keyLocation);
      console.log(`  batch ${index / BATCH + 1}: HTTP ${result.status} (${batch.length} URLs)`);
    }
    if (changed) {
      await writeFile(
        STATE_FILE,
        `${JSON.stringify({ lastRun: new Date().toISOString(), lastUrls: urls.length }, null, 2)}\n`
      );
    }
  }
  console.log(`RESULTADO: ${urls.length} urls enviadas`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`IndexNow failed: ${error.message}`);
    process.exit(1);
  });
}
