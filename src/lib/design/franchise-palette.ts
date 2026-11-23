/**
 * Acento por franquicia editorial: cada categoría del catálogo tiñe su tarjeta
 * con un color propio vía las variables `--qv-accent`, `--qv-accent-soft` y
 * `--qv-on-accent` puestas por `style` en la tarjeta. Sin entrada en el mapa
 * la tarjeta no recibe variables y queda el acento lima actual.
 *
 * Todos los acentos son luminosos pensados para el fondo oscuro: el test de
 * contraste exige AA (≥ 4.5) entre `onAccent` y `accent`, que es lo que lee
 * el texto pintado sobre el acento (p. ej. el botón «Jugar»).
 */
export interface FranchiseAccent {
  /** Acento principal (`--qv-accent`). */
  accent: string;
  /** Velo del acento para fondos (`--qv-accent-soft`, hex con alfa ~14%). */
  soft: string;
  /** Tinta con contraste AA sobre `accent` (`--qv-on-accent`). */
  onAccent: string;
}

const INK = '#101019';

/** Velo del acento al ~14% de alfa para tintar superficies sin repintarlas. */
const softOf = (accent: string) => `${accent}24`;

const CATEGORY_ACCENTS: Record<string, FranchiseAccent> = {
  trivia: { accent: '#d9ff43', soft: softOf('#d9ff43'), onAccent: INK },
  personality: { accent: '#ff7ad9', soft: softOf('#ff7ad9'), onAccent: INK },
  culture: { accent: '#c9b0ff', soft: softOf('#c9b0ff'), onAccent: INK },
  lifestyle: { accent: '#7dffc7', soft: softOf('#7dffc7'), onAccent: INK },
  'movies-tv': { accent: '#ff6b6b', soft: softOf('#ff6b6b'), onAccent: INK },
  'anime-manga': { accent: '#f78fff', soft: softOf('#f78fff'), onAccent: INK },
  gaming: { accent: '#9d8bff', soft: softOf('#9d8bff'), onAccent: INK },
  music: { accent: '#6ee7ff', soft: softOf('#6ee7ff'), onAccent: INK },
  literature: { accent: '#ffd166', soft: softOf('#ffd166'), onAccent: INK },
  'pop-culture': { accent: '#ff9f5a', soft: softOf('#ff9f5a'), onAccent: INK },
  technology: { accent: '#6ea8ff', soft: softOf('#6ea8ff'), onAccent: INK },
  relationships: { accent: '#ff8fab', soft: softOf('#ff8fab'), onAccent: INK },
  'food-drink': { accent: '#ffcf7d', soft: softOf('#ffcf7d'), onAccent: INK },
  science: { accent: '#5df2d0', soft: softOf('#5df2d0'), onAccent: INK },
  animals: { accent: '#a8e06e', soft: softOf('#a8e06e'), onAccent: INK },
  sports: { accent: '#ff8a5c', soft: softOf('#ff8a5c'), onAccent: INK },
  geography: { accent: '#6fd3a7', soft: softOf('#6fd3a7'), onAccent: INK },
  history: { accent: '#e3b778', soft: softOf('#e3b778'), onAccent: INK },
};

/**
 * Acento de la categoría (la franquicia editorial del sitio agrupa por tema).
 * `undefined` = la tarjeta conserva el acento por defecto.
 */
export function accentForCategory(slug: string | null | undefined): FranchiseAccent | undefined {
  return slug ? CATEGORY_ACCENTS[slug] : undefined;
}

/** Luminancia relativa WCAG de un `#rrggbb`. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '').slice(0, 6);
  const channel = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Ratio de contraste WCAG entre dos colores `#rrggbb` (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/* ------------------------------------------------------------------------- */
/* Arte propio determinista de portada (L8)                                  */
/* ------------------------------------------------------------------------- */

/**
 * Regla gráfica única para las portadas sin foto: la usan la tarjeta (SVG en
 * línea, sin petición extra) y `/covers` (SVG servido), así que una portada
 * procedural, una `null` y el fallback de un proveedor caído se ven igual.
 *
 * El motivo sale de la categoría y las variaciones (campo, ángulo, densidad,
 * segundo color) del hash del slug: dos quizzes de la misma categoría
 * comparten familia gráfica pero no son la misma imagen. Sin fotos de la
 * franquicia ni texto inventado: solo forma, color y la inicial del título.
 */
export type CoverMotif =
  | 'tiles'
  | 'burst'
  | 'stripes'
  | 'film'
  | 'pixels'
  | 'bars'
  | 'lanes'
  | 'ridges'
  | 'dots'
  | 'stack';

const MOTIF_BY_CATEGORY: Record<string, CoverMotif> = {
  trivia: 'tiles',
  personality: 'burst',
  culture: 'stripes',
  lifestyle: 'stack',
  'movies-tv': 'film',
  'anime-manga': 'burst',
  gaming: 'pixels',
  music: 'bars',
  literature: 'stack',
  'pop-culture': 'dots',
  technology: 'pixels',
  relationships: 'stack',
  'food-drink': 'dots',
  science: 'dots',
  animals: 'ridges',
  sports: 'lanes',
  geography: 'ridges',
  history: 'stripes',
};

/** Segundo color: la paleta Arcade Pop de L7, siempre distinto del acento. */
const POP = ['#ff4d97', '#8458ff', '#62f6cf', '#ffd166', '#d9ff43', '#6ee7ff'];
const NIGHT_FIELD = '#191826';

export interface CoverArtSpec {
  motif: CoverMotif;
  /** `pleno`: campo del acento con motivo en tinta. `night`: campo oscuro con motivo del acento. */
  mode: 'pleno' | 'night';
  field: string;
  ink: string;
  second: string;
  accent: string;
  /** Inicial del título (letra o número) en mayúscula; `?` si no hay. */
  glyph: string;
  seed: number;
}

export interface CoverArtInput {
  slug: string;
  title: string;
  quizType: string;
  categorySlug?: string | null;
}

/** FNV-1a de 32 bits: estable entre servidor, Worker y navegador. */
export function hashSlug(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function rng(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Palabras de arranque que casi todos los títulos comparten («¿Qué…», «¿Cuál…»,
 * «Which…»): si la inicial saliera de ellas, media grilla tendría la misma letra.
 */
const GLYPH_SKIP = new Set([
  'que',
  'qué',
  'cual',
  'cuál',
  'cuales',
  'cuáles',
  'como',
  'cómo',
  'cuanto',
  'cuánto',
  'cuanta',
  'cuánta',
  'cuantos',
  'cuántos',
  'quien',
  'quién',
  'tipo',
  'eres',
  'sabes',
  'trivia',
  'which',
  'what',
  'whats',
  'how',
  'who',
  'much',
  'many',
  'does',
  'would',
  'could',
  'your',
  'are',
  'you',
  'the',
  'quiz',
]);

/**
 * Inicial de la portada: primera letra de la primera palabra con peso del
 * título (≥ 4 letras y fuera de GLYPH_SKIP); si no hay, la primera letra o
 * cifra. Nunca «¿», comillas ni signos.
 */
export function coverGlyph(title: string): string {
  const words = title.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
  const strong = words.find((word) => word.length >= 4 && !GLYPH_SKIP.has(word.toLowerCase()));
  const pick = strong ?? words[0];
  return pick ? pick[0].toLocaleUpperCase('es') : '?';
}

/**
 * Especificación de la portada. `forceMode` fija el campo cuando el contexto
 * lo exige: `pleno` cuando la portada imprime el título encima (tinta sobre
 * acento, AA garantizado por el test de la paleta) y `night` en los SVG con
 * banda de texto oscura.
 */
export function coverArtSpec(input: CoverArtInput, forceMode?: 'pleno' | 'night'): CoverArtSpec {
  const seed = hashSlug(input.slug || input.title);
  const categoryAccent = accentForCategory(input.categorySlug) ?? accentForCategory(input.quizType);
  const accent = categoryAccent?.accent ?? '#d9ff43';
  const motif =
    (input.categorySlug ? MOTIF_BY_CATEGORY[input.categorySlug] : undefined) ??
    MOTIF_BY_CATEGORY[input.quizType] ??
    'tiles';
  const pool = POP.filter((color) => color.toLowerCase() !== accent.toLowerCase());
  const second = pool[seed % pool.length];
  const mode = forceMode ?? (seed % 3 === 0 ? 'night' : 'pleno');
  return {
    motif,
    mode,
    field: mode === 'night' ? NIGHT_FIELD : accent,
    ink: mode === 'night' ? accent : INK,
    second,
    accent,
    glyph: coverGlyph(input.title),
    seed,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Formas del motivo para un lienzo `w × h`. Solo números y colores hex de la
 * paleta: nada que escriba un usuario entra aquí, así que el marcado es
 * seguro de insertar tal cual en un SVG en línea o servido.
 */
export function coverMotifMarkup(spec: CoverArtSpec, w = 300, h = 200): string {
  const rand = rng(spec.seed);
  const { ink, second } = spec;
  const out: string[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const span = Math.hypot(w, h);
  const tilt = r1(-14 + rand() * 28);
  // Id único por slug para los <pattern>/<mask>: varias tarjetas conviven en la página.
  const id = `qv8${spec.seed.toString(36)}`;

  switch (spec.motif) {
    case 'tiles': {
      const size = r1([w / 9, w / 7, w / 6][Math.floor(rand() * 3)]);
      const cells: string[] = [];
      for (let k = 0; k < 4; k++) {
        const i = Math.floor(rand() * 8) - 4;
        const j = Math.floor(rand() * 6) - 3;
        const ii = (i + j) % 2 === 0 ? i : i + 1;
        cells.push(
          `<rect x="${r1(cx + ii * size)}" y="${r1(cy + j * size)}" width="${size}" height="${size}" fill="${second}"/>`
        );
      }
      out.push(
        `<defs><pattern id="${id}" width="${r1(size * 2)}" height="${r1(size * 2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${tilt} ${cx} ${cy}) translate(${cx} ${cy})"><rect width="${size}" height="${size}" fill="${ink}"/><rect x="${size}" y="${size}" width="${size}" height="${size}" fill="${ink}"/></pattern></defs>`,
        `<rect x="${r1(-w)}" y="${r1(-h)}" width="${w * 3}" height="${h * 3}" fill="url(#${id})" opacity="0.22"/>`,
        `<g transform="rotate(${tilt} ${cx} ${cy})">${cells.join('')}</g>`
      );
      break;
    }
    case 'burst': {
      const ox = r1(w * (0.55 + rand() * 0.3));
      const oy = r1(h * (0.25 + rand() * 0.5));
      const rays = 18 + Math.floor(rand() * 10);
      const step = (Math.PI * 2) / rays;
      const offset = rand() * step;
      for (let i = 0; i < rays; i += 2) {
        const a = offset + i * step;
        const b = a + step * (0.55 + rand() * 0.35);
        const p1 = `${r1(ox + Math.cos(a) * span)},${r1(oy + Math.sin(a) * span)}`;
        const p2 = `${r1(ox + Math.cos(b) * span)},${r1(oy + Math.sin(b) * span)}`;
        const hit = i % 6 === 0;
        out.push(
          `<polygon points="${ox},${oy} ${p1} ${p2}" fill="${hit ? second : ink}" opacity="${hit ? 0.9 : 0.2}"/>`
        );
      }
      break;
    }
    case 'stripes': {
      const band = w / (7 + Math.floor(rand() * 5));
      const n = Math.ceil((span * 2) / band) + 2;
      const pick = 2 * Math.floor((rand() * n) / 2);
      const bands: string[] = [];
      for (let i = 0; i < n; i += 2) {
        const x = cx - span + i * band;
        const hit = i === pick || i === pick + 6;
        bands.push(
          `<rect x="${r1(x)}" y="${r1(cy - span)}" width="${r1(band)}" height="${r1(span * 2)}" fill="${hit ? second : ink}" opacity="${hit ? 1 : 0.2}"/>`
        );
      }
      out.push(`<g transform="rotate(${r1(28 + rand() * 24)} ${cx} ${cy})">${bands.join('')}</g>`);
      break;
    }
    case 'film': {
      // Dos tiras separadas por 2 alturas exactas: un solo patrón alinea las perforaciones.
      const stripH = h * 0.25;
      const hole = stripH * 0.22;
      const parts: string[] = [];
      parts.push(
        `<defs><pattern id="${id}" y="${r1(h * 0.12)}" width="${r1(hole * 2.2)}" height="${r1(stripH)}" patternUnits="userSpaceOnUse"><rect y="${r1(hole * 0.6)}" width="${r1(hole)}" height="${r1(hole)}" fill="${spec.field}"/><rect y="${r1(stripH - hole * 1.6)}" width="${r1(hole)}" height="${r1(hole)}" fill="${spec.field}"/></pattern></defs>`
      );
      for (const y of [h * 0.12, h * 0.62]) {
        parts.push(
          `<rect x="${r1(-w * 0.3)}" y="${r1(y)}" width="${r1(w * 1.6)}" height="${r1(stripH)}" fill="${ink}" opacity="0.88"/>`,
          `<rect x="${r1(-w * 0.3)}" y="${r1(y)}" width="${r1(w * 1.6)}" height="${r1(stripH)}" fill="url(#${id})"/>`
        );
      }
      parts.push(
        `<rect x="${r1(w * (0.15 + rand() * 0.5))}" y="${r1(h * 0.12 + stripH * 0.36)}" width="${r1(w * 0.18)}" height="${r1(stripH * 0.28)}" fill="${second}"/>`
      );
      out.push(`<g transform="rotate(${r1(tilt * 0.6)} ${cx} ${cy})">${parts.join('')}</g>`);
      break;
    }
    case 'pixels': {
      const size = r1(w / (9 + Math.floor(rand() * 3)));
      const cell = r1(size - 1);
      const cols = Math.ceil(w / size);
      const rows = Math.ceil(h / size);
      const base: string[] = [];
      const hits: string[] = [];
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          // Densidad creciente hacia abajo a la derecha: un horizonte de píxeles.
          const chance = ((i / cols) * 0.55 + (j / rows) * 0.75) ** 2.2;
          if (rand() > chance) continue;
          (rand() < 0.1 ? hits : base).push(
            `<rect x="${r1(i * size)}" y="${r1(j * size)}" width="${cell}" height="${cell}"/>`
          );
        }
      }
      out.push(
        `<g fill="${ink}" opacity="0.32">${base.join('')}</g>`,
        `<g fill="${second}">${hits.join('')}</g>`
      );
      break;
    }
    case 'bars': {
      const count = 10 + Math.floor(rand() * 6);
      const slot = w / count;
      const bw = r1(slot * 0.64);
      const bars: string[] = [];
      const caps: string[] = [];
      for (let i = 0; i < count; i++) {
        const x = r1(i * slot + slot * 0.18);
        const top = h * (1 - (0.18 + rand() * 0.66));
        bars.push(`<rect x="${x}" y="${r1(top)}" width="${bw}" height="${r1(h - top)}"/>`);
        caps.push(
          `<rect x="${x}" y="${r1(top - slot * 0.5)}" width="${bw}" height="${r1(slot * 0.22)}"/>`
        );
      }
      out.push(
        `<g fill="${ink}" opacity="0.26">${bars.join('')}</g>`,
        `<g fill="${second}">${caps.join('')}</g>`
      );
      break;
    }
    case 'lanes': {
      const lane = h / 6;
      const parts: string[] = [];
      for (let i = -4; i < 10; i++) {
        parts.push(
          `<rect x="${r1(-w)}" y="${r1(i * lane)}" width="${r1(w * 3)}" height="${r1(lane * 0.12)}" fill="${ink}" opacity="0.3"/>`
        );
      }
      const base = w * (0.2 + rand() * 0.25);
      for (let k = 0; k < 3; k++) {
        const x = base + k * w * 0.13;
        parts.push(
          `<polygon points="${r1(x)},${r1(cy - h * 0.3)} ${r1(x + w * 0.09)},${r1(cy - h * 0.3)} ${r1(x + w * 0.2)},${r1(cy)} ${r1(x + w * 0.09)},${r1(cy + h * 0.3)} ${r1(x)},${r1(cy + h * 0.3)} ${r1(x + w * 0.11)},${r1(cy)}" fill="${k === 2 ? second : ink}" opacity="${k === 2 ? 1 : 0.35}"/>`
        );
      }
      out.push(`<g transform="rotate(${r1(-10 + rand() * 6)} ${cx} ${cy})">${parts.join('')}</g>`);
      break;
    }
    case 'ridges': {
      const layers = 5 + Math.floor(rand() * 3);
      for (let k = 0; k < layers; k++) {
        const y0 = h * (0.2 + (k / layers) * 0.85);
        const amp = h * (0.06 + rand() * 0.08);
        const teeth = 4 + Math.floor(rand() * 4);
        const pts: string[] = [`-10,${r1(h + 10)}`, `-10,${r1(y0)}`];
        for (let t = 0; t <= teeth; t++) {
          pts.push(`${r1((w / teeth) * t)},${r1(y0 + (t % 2 === 0 ? amp : -amp))}`);
        }
        pts.push(`${r1(w + 10)},${r1(h + 10)}`);
        const hit = k === layers - 2;
        out.push(
          `<polygon points="${pts.join(' ')}" fill="${hit ? second : ink}" opacity="${hit ? 0.95 : 0.16}"/>`
        );
      }
      break;
    }
    case 'dots': {
      // Semitono en tres bandas de tamaño creciente (patrón + diagonal), sin
      // un <circle> por punto: el marcado queda en un par de cientos de bytes.
      const gap = r1(w / (14 + Math.floor(rand() * 6)));
      const angle = rand() < 0.5 ? 35 : -35;
      const defs: string[] = [];
      const bands: string[] = [];
      [0.16, 0.28, 0.42].forEach((ratio, k) => {
        defs.push(
          `<pattern id="${id}${k}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse"><circle cx="${r1(gap / 2)}" cy="${r1(gap / 2)}" r="${r1(gap * ratio)}" fill="${ink}"/></pattern>`
        );
        bands.push(
          `<rect x="${r1(-w + k * w * 0.62)}" y="${r1(-h)}" width="${r1(w * 3)}" height="${h * 3}" fill="url(#${id}${k})" opacity="0.32" transform="rotate(${angle} ${cx} ${cy})"/>`
        );
      });
      out.push(`<defs>${defs.join('')}</defs>`, ...bands);
      out.push(
        // Barra del segundo color a la izquierda: a la derecha va la inicial y
        // encima de ella se leería como una tilde.
        `<rect x="${r1(w * (0.04 + rand() * 0.16))}" y="${r1(h * 0.14)}" width="${r1(w * 0.26)}" height="${r1(h * 0.1)}" fill="${second}" transform="rotate(${r1(tilt * 0.4)} ${r1(w * 0.2)} ${r1(h * 0.2)})"/>`
      );
      break;
    }
    case 'stack': {
      const cardW = w * 0.42;
      const cardH = h * 0.62;
      const sx = w * (0.08 + rand() * 0.2);
      const sy = h * 0.3;
      const parts: string[] = [];
      for (let k = 3; k >= 0; k--) {
        parts.push(
          `<rect x="${r1(sx + k * w * 0.07)}" y="${r1(sy - k * h * 0.08)}" width="${r1(cardW)}" height="${r1(cardH)}" fill="${k === 0 ? second : spec.field}" stroke="${ink}" stroke-width="${r1(w * 0.012)}" stroke-opacity="${k === 0 ? 1 : 0.5}"/>`
        );
      }
      out.push(`<g transform="rotate(${r1(tilt * 0.5)} ${cx} ${cy})">${parts.join('')}</g>`);
      break;
    }
  }
  return out.join('');
}
