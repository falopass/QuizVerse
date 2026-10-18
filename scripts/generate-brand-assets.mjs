#!/usr/bin/env node
/**
 * Generates the brand raster assets used by SEO and the PWA manifest.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Outputs (all committed, served from /public):
 *   public/favicon.ico                 multi-resolution 16/32/48 (PNG-in-ICO)
 *   public/icons/icon.svg              vector master for modern browsers
 *   public/icons/icon-{16..512}.png    declared in layout metadata + manifest
 *   public/icons/apple-touch-icon.png  180×180, opaque (iOS adds its own mask)
 *   public/icons/maskable-512.png      Android adaptive icon with a safe zone
 *   public/og/quizverse-og.png         1200×630 default share card
 *
 * Google only shows a favicon when it is square and at least 48×48, so the
 * 48/96/144/192 sizes are not optional.
 */

import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

const FONT_FILE = join(PUBLIC, 'fonts', 'ArchivoBlack-Regular.ttf');
const FONT_FAMILY = 'Archivo Black';

const INK = '#101019';
const LIME = '#d9ff43';
const PINK = '#ff4d97';
const PURPLE = '#8458ff';
const PAPER = '#f6f3ff';

/** Renders an SVG document to a PNG buffer at an exact pixel width. */
async function renderPng(svg, width) {
  const fontData = await readFile(FONT_FILE);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles: [FONT_FILE],
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
      defaultFontSize: 16,
    },
    // Keep the SVG's own background; fail loudly if fonts are unusable.
    logLevel: 'error',
  });
  if (fontData.length === 0) throw new Error('Empty font file');
  return resvg.render().asPng();
}

/* ------------------------------------------------------------------ *
 * Square brand mark
 * ------------------------------------------------------------------ */

/**
 * Lime rounded square + dark "Q".
 *
 * Two optical sizes: below 48px the type glyph's counter and tail collapse into
 * a blob, so small sizes use a geometric Q drawn with a ring and a tail, which
 * keeps the counter open at 16×16. Larger sizes use the real Archivo Black
 * glyph so the favicon matches the wordmark exactly.
 */
function markSvg({ size, rounded, safeArea, compact = false }) {
  const radius = rounded ? size * 0.19 : 0;

  if (compact) {
    const unit = size;
    const ring = {
      cx: unit * 0.455,
      cy: unit * 0.455,
      r: unit * 0.265,
      stroke: unit * 0.155,
    };
    const tail = {
      x1: unit * 0.62,
      y1: unit * 0.66,
      x2: unit * 0.815,
      y2: unit * 0.855,
      stroke: unit * 0.155,
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${LIME}"/>
  <circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${INK}" stroke-width="${ring.stroke}"/>
  <line x1="${tail.x1}" y1="${tail.y1}" x2="${tail.x2}" y2="${tail.y2}" stroke="${INK}" stroke-width="${tail.stroke}" stroke-linecap="butt"/>
</svg>`;
  }

  const glyph = size * (safeArea ? 0.44 : 0.62);
  // Archivo Black cap height ≈ 0.72em; the tail pulls right and low, so the
  // optical centre sits a touch left and up of the geometric one.
  const baseline = size * 0.5 + glyph * 0.355;
  const centreX = size * (safeArea ? 0.5 : 0.474);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${LIME}"/>
  <text x="${centreX}" y="${baseline}" text-anchor="middle" font-family="${FONT_FAMILY}"
        font-size="${glyph}" font-weight="400" fill="${INK}" letter-spacing="-0.04em">Q</text>
</svg>`;
}

/** ICO container with PNG payloads — supported by every browser that matters. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 1 * 2); // type: icon
  header.writeUInt16LE(images.length, 2 * 2); // image count

  const entries = Buffer.alloc(16 * images.length);
  let offset = header.length + entries.length;

  images.forEach((image, index) => {
    const base = index * 16;
    entries.writeUInt8(image.size >= 256 ? 0 : image.size, base + 0);
    entries.writeUInt8(image.size >= 256 ? 0 : image.size, base + 1);
    entries.writeUInt8(0, base + 2); // palette size
    entries.writeUInt8(0, base + 3); // reserved
    entries.writeUInt16LE(1, base + 4); // colour planes
    entries.writeUInt16LE(32, base + 6); // bits per pixel
    entries.writeUInt32LE(image.png.length, base + 8);
    entries.writeUInt32LE(offset, base + 12);
    offset += image.png.length;
  });

  return Buffer.concat([header, entries, ...images.map((image) => image.png)]);
}

/* ------------------------------------------------------------------ *
 * Default social card (1200×630)
 * ------------------------------------------------------------------ */

const OG_COPY = {
  en: {
    line1: 'PLAY YOUR',
    line2: 'POP CULTURE.',
    subtitle: 'Personality tests, sharp trivia and fandom challenges.',
    file: 'quizverse-og.png',
  },
  es: {
    line1: 'JUEGA TU',
    line2: 'CULTURA POP.',
    subtitle: 'Tests de personalidad, trivia y retos de fandom.',
    file: 'quizverse-og-es.png',
  },
};

function ogSvg(locale = 'en') {
  const copy = OG_COPY[locale];
  const W = 1200;
  const H = 630;
  const pad = 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>

  <!-- arcade grid texture -->
  <g stroke="#22212f" stroke-width="1">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 120}" y1="0" x2="${i * 120}" y2="${H}"/>`).join('\n    ')}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${i * 126}" x2="${W}" y2="${i * 126}"/>`).join('\n    ')}
  </g>

  <!-- offset card behind the mark -->
  <rect x="${W - 330}" y="132" width="212" height="212" rx="10" fill="${PURPLE}" transform="rotate(7 ${W - 224} 238)"/>
  <rect x="${W - 300}" y="152" width="212" height="212" rx="10" fill="${PINK}" transform="rotate(-4 ${W - 194} 258)"/>

  <!-- brand mark -->
  <g transform="translate(${W - 278} 180)">
    <rect width="152" height="152" rx="29" fill="${LIME}"/>
    <text x="76" y="${76 + 96 * 0.355}" text-anchor="middle" font-family="${FONT_FAMILY}"
          font-size="96" fill="${INK}" letter-spacing="-0.04em">Q</text>
  </g>

  <!-- wordmark -->
  <text x="${pad}" y="${pad + 34}" font-family="${FONT_FAMILY}" font-size="40" letter-spacing="-0.055em" fill="${PAPER}">QUIZ<tspan fill="${LIME}">VERSE</tspan></text>

  <!-- headline -->
  <text x="${pad - 4}" y="300" font-family="${FONT_FAMILY}" font-size="104" letter-spacing="-0.065em" fill="${PAPER}">${copy.line1}</text>
  <text x="${pad - 4}" y="398" font-family="${FONT_FAMILY}" font-size="104" letter-spacing="-0.065em" fill="${LIME}">${copy.line2}</text>

  <!-- subtitle -->
  <text x="${pad}" y="456" font-family="${FONT_FAMILY}" font-size="26" letter-spacing="-0.02em" fill="#d0cddb">${copy.subtitle}</text>

  <!-- footer -->
  <line x1="${pad}" y1="${H - 92}" x2="${W - pad}" y2="${H - 92}" stroke="#474558" stroke-width="2"/>
  <text x="${pad}" y="${H - 46}" font-family="${FONT_FAMILY}" font-size="24" letter-spacing="0.06em" fill="${PAPER}">QUIZVERSE.ORG</text>
  <text x="${W - pad}" y="${H - 46}" text-anchor="end" font-family="${FONT_FAMILY}" font-size="24" letter-spacing="0.06em" fill="${LIME}">EN / ES</text>
</svg>`;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function main() {
  await mkdir(join(PUBLIC, 'icons'), { recursive: true });
  await mkdir(join(PUBLIC, 'og'), { recursive: true });

  // Vector master (browsers that support SVG favicons get a crisp render).
  await writeFile(
    join(PUBLIC, 'icons', 'icon.svg'),
    markSvg({ size: 64, rounded: true, safeArea: false }),
    'utf8'
  );

  const pngSizes = [16, 32, 48, 96, 144, 192, 256, 512];
  const rendered = new Map();
  for (const size of pngSizes) {
    const png = await renderPng(
      markSvg({ size, rounded: true, safeArea: false, compact: size < 48 }),
      size
    );
    rendered.set(size, png);
    await writeFile(join(PUBLIC, 'icons', `icon-${size}.png`), png);
  }

  // Apple touch icon: opaque, no pre-rounded corners (iOS masks it).
  const apple = await renderPng(markSvg({ size: 180, rounded: false, safeArea: false }), 180);
  await writeFile(join(PUBLIC, 'icons', 'apple-touch-icon.png'), apple);

  // Android maskable: glyph inside the 80% safe circle.
  const maskable = await renderPng(markSvg({ size: 512, rounded: false, safeArea: true }), 512);
  await writeFile(join(PUBLIC, 'icons', 'maskable-512.png'), maskable);

  // Multi-resolution ICO for the tab bar and Google's favicon crawler.
  const ico = buildIco([16, 32, 48].map((size) => ({ size, png: rendered.get(size) })));
  await writeFile(join(PUBLIC, 'favicon.ico'), ico);

  // Default social cards, one per locale.
  for (const locale of ['en', 'es']) {
    const og = await renderPng(ogSvg(locale), 1200);
    await writeFile(join(PUBLIC, 'og', OG_COPY[locale].file), og);
  }

  const report = [
    'icons/icon.svg',
    ...pngSizes.map((size) => `icons/icon-${size}.png`),
    'icons/apple-touch-icon.png',
    'icons/maskable-512.png',
    'favicon.ico',
    ...Object.values(OG_COPY).map((copy) => `og/${copy.file}`),
  ];
  console.log(`Generated ${report.length} assets:`);
  for (const file of report) console.log(`  public/${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
