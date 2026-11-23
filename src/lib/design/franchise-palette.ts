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
