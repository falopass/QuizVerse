#!/usr/bin/env node
/**
 * IndexNow submission — pushes every URL in the sitemap to Bing, Yandex,
 * Seznam and Naver within minutes instead of waiting for a recrawl.
 *
 *   node scripts/submit-indexnow.mjs                 # submit all sitemap URLs
 *   node scripts/submit-indexnow.mjs --dry-run       # print what would be sent
 *   node scripts/submit-indexnow.mjs --urls /en/quiz,/es/quiz
 *   node scripts/submit-indexnow.mjs --site https://quizverse.org
 *
 * The protocol requires a key file at the site root: public/<key>.txt must
 * contain exactly that key. This script looks for it in public/ and refuses to
 * run if the file is missing — submitting with an unreachable key file returns
 * 403 and silently teaches the search engines nothing.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const KEY_PATTERN = /^[a-f0-9]{8,128}\.txt$/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const siteArg = args.indexOf('--site');
const urlsArg = args.indexOf('--urls');
const site = (
  siteArg !== -1 ? args[siteArg + 1] : process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'
).replace(/\/+$/, '');

/** IndexNow endpoints. The shared one fans out to every participating engine. */
const ENDPOINT = 'https://api.indexnow.org/indexnow';

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

async function sitemapUrls() {
  const response = await fetch(`${site}/sitemap.xml`, {
    headers: { accept: 'application/xml' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${site}/sitemap.xml (HTTP ${response.status})`);
  }
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  if (urls.length === 0) throw new Error('Sitemap returned no <loc> entries');
  return urls;
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

  const urls =
    urlsArg !== -1
      ? args[urlsArg + 1]
          .split(',')
          .map((path) => (path.startsWith('http') ? path : `${site}${path}`))
      : await sitemapUrls();

  console.log(`Submitting ${urls.length} URLs to IndexNow (${dryRun ? 'dry run' : 'live'})`);

  if (dryRun) {
    for (const url of urls.slice(0, 10)) console.log(`  ${url}`);
    if (urls.length > 10) console.log(`  … and ${urls.length - 10} more`);
    return;
  }

  // IndexNow accepts up to 10.000 URLs per request; batch to keep payloads sane.
  const BATCH = 500;
  for (let index = 0; index < urls.length; index += BATCH) {
    const batch = urls.slice(index, index + BATCH);
    const result = await submit(batch, key, keyLocation);
    console.log(`  batch ${index / BATCH + 1}: HTTP ${result.status} (${batch.length} URLs)`);
  }
  console.log('Done.');
}

main().catch((error) => {
  console.error(`IndexNow failed: ${error.message}`);
  process.exit(1);
});
