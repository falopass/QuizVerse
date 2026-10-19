// seo-check.mjs — auditoría SEO sobre el HTML servido (QUAL-36).
// Uso: node scripts/seo-check.mjs <baseUrl> [--limit 12] [--paths /es,/en/quiz] [--report]
// Sin deps nuevas. No escribe archivos ni toca la base de datos.

import { pathToFileURL } from 'node:url';

const DEFAULT_LIMIT = 12;

export function parseSitemap(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const loc = match[1].trim();
    if (/^https?:\/\//.test(loc) && !urls.includes(loc)) urls.push(loc);
  }
  return urls;
}

function stripTags(s) {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html) {
  return stripTags(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  );
}

function isAbsolute(href) {
  return /^https?:\/\//.test(href);
}

function stripTrailingSlash(u) {
  return u.replace(/\/+$/, '');
}

export function findCopyBugs(html) {
  const text = visibleText(html);
  const findings = [];
  const patterns = [
    [/\b1 quizzes\b/i, '«1 quizzes» (singular sin pluralizar)'],
    [/\bundefined\b/, '«undefined» visible'],
    [/\[object Object\]/, '«[object Object]» visible'],
    [/\bNaN\b/, '«NaN» visible'],
  ];
  for (const [re, detail] of patterns) {
    const m = text.match(re);
    if (m) findings.push({ level: 'error', code: 'copy-bug', detail: `${detail}: «${m[0]}»` });
  }
  return findings;
}

export function checkHtml(html, url, status = 200) {
  const f = [];
  const err = (code, detail) => f.push({ level: 'error', code, detail });
  const warn = (code, detail) => f.push({ level: 'warn', code, detail });

  if (status !== 200) {
    err('http-status', `HTTP ${status}`);
    return f; // sin 200 el resto del HTML no es confiable
  }

  // h1: exactamente uno y no del esqueleto de carga
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  if (h1s.length !== 1) err('h1-count', `${h1s.length} <h1> (debe haber exactamente 1)`);
  else if (/^(cargando|loading)\b/i.test(h1s[0]))
    err('h1-skeleton', `el <h1> es el esqueleto de carga: «${h1s[0].slice(0, 60)}»`);

  // title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';
  if (!title) err('title-missing', 'sin <title>');
  else if (title.length < 20 || title.length > 65)
    err('title-length', `<title> de ${title.length} chars (20–65): «${title.slice(0, 70)}»`);

  // meta description
  const descMatch = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i);
  const desc = descMatch ? (descMatch[0].match(/content=["']([^"']*)["']/i)?.[1] ?? '') : '';
  if (!descMatch) err('description-missing', 'sin meta[name=description]');
  else if (desc.length < 70 || desc.length > 158)
    err('description-length', `description de ${desc.length} chars (70–158)`);

  // canonical
  const canonMatch = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
  if (!canonMatch) err('canonical-missing', 'sin link[rel=canonical]');
  else {
    const href = canonMatch[0].match(/href=["']([^"']*)["']/i)?.[1] ?? '';
    if (!isAbsolute(href)) err('canonical-relative', `canonical no absoluto: «${href}»`);
    else if (stripTrailingSlash(href) !== stripTrailingSlash(url))
      err('canonical-mismatch', `canonical «${href}» ≠ URL «${url}»`);
  }

  // hreflang
  const alternates = [
    ...html.matchAll(/<link\b[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*>/gi),
    ...html.matchAll(/<link\b[^>]*hreflang=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*>/gi),
  ];
  if (alternates.length > 0) {
    const langs = new Set();
    for (const m of alternates) {
      langs.add(m[1]);
      const href = m[0].match(/href=["']([^"']*)["']/i)?.[1] ?? '';
      if (!isAbsolute(href)) err('hreflang-relative', `hreflang=${m[1]} no absoluto: «${href}»`);
    }
    for (const need of ['en', 'es', 'x-default'])
      if (!langs.has(need)) warn('hreflang-incomplete', `falta hreflang=${need}`);
  }

  // JSON-LD
  const ldBlocks = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  ldBlocks.forEach((m, i) => {
    try {
      const data = JSON.parse(m[1]);
      if (!data['@context'] || !data['@graph'])
        err('jsonld-shape', `bloque ${i + 1}: sin @context o @graph`);
    } catch {
      err('jsonld-invalid', `bloque ${i + 1}: JSON inválido`);
    }
  });

  // og:image
  const ogMatch = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i);
  if (!ogMatch) warn('og-image-missing', 'sin meta[property=og:image]');
  else {
    const content = ogMatch[0].match(/content=["']([^"']*)["']/i)?.[1] ?? '';
    if (!isAbsolute(content)) err('og-image-relative', `og:image no absoluto: «${content}»`);
  }

  f.push(...findCopyBugs(html));
  return f;
}

function parseArgs(argv) {
  const args = { baseUrl: null, limit: DEFAULT_LIMIT, paths: null, report: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--paths') args.paths = argv[++i].split(',').filter(Boolean);
    else if (a === '--report') args.report = true;
    else if (!a.startsWith('--') && !args.baseUrl) args.baseUrl = a;
  }
  return args;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'quizverse-seo-check/1.0' } });
  return { status: res.status, body: await res.text() };
}

async function main() {
  const { baseUrl, limit, paths, report } = parseArgs(process.argv.slice(2));
  if (!baseUrl) {
    console.error(
      'uso: node scripts/seo-check.mjs <baseUrl> [--limit N] [--paths /a,/b] [--report]'
    );
    process.exit(2);
  }
  const base = baseUrl.replace(/\/+$/, '');

  let urls;
  if (paths) {
    // MSYS/Git Bash convierte un arg que empieza por "/" a ruta Windows
    // ("/es" → "C:/Program Files/Git/es"); se revierte aquí.
    const clean = (p) => p.replace(/^[A-Za-z]:[\\/].*(?=\/)/, '');
    urls = paths.map((p) =>
      p.startsWith('http') ? p : `${base}${clean(p).startsWith('/') ? clean(p) : `/${clean(p)}`}`
    );
  } else {
    let xml;
    try {
      const res = await fetchText(`${base}/sitemap.xml`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      xml = res.body;
    } catch (e) {
      console.error(`no pude leer ${base}/sitemap.xml (${e.message}); usa --paths`);
      process.exit(2);
    }
    urls = parseSitemap(xml).slice(0, limit);
    for (const p of ['/es', '/en']) {
      const u = `${base}${p}`;
      if (!urls.includes(u)) urls.unshift(u);
    }
  }

  let errors = 0;
  let warns = 0;
  for (const url of urls) {
    let findings;
    try {
      const { status, body } = await fetchText(url);
      findings = checkHtml(body, url, status);
    } catch (e) {
      findings = [{ level: 'error', code: 'fetch-failed', detail: e.message }];
    }
    const errs = findings.filter((x) => x.level === 'error');
    const wrns = findings.filter((x) => x.level === 'warn');
    errors += errs.length;
    warns += wrns.length;
    if (findings.length === 0) {
      console.log(`PASS  ${url}`);
    } else {
      console.log(`FAIL  ${url}  ${errs.length} error(es), ${wrns.length} warning(s)`);
      for (const x of findings)
        console.log(`      ${x.level.toUpperCase()} ${x.code}: ${x.detail}`);
    }
  }
  console.log(`\n${urls.length} URLs — ${errors} error(es), ${warns} warning(s)`);
  if (report) return;
  process.exit(errors > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
