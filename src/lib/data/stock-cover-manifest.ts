import 'server-only';

import manifestJson from './stock-cover-manifest.json';

export interface StockCoverEntry {
  slug: string;
  provider: 'pexels' | 'pixabay';
  image_url: string;
  source_url: string;
  photographer?: string;
  photographer_url?: string;
  attribution: string;
  query: string;
  theme_key?: string;
  visual_family?: string;
  width?: number;
  height?: number;
  score?: number;
  /** Hash de `image_url`; versión estable de la URL pública para caché inmutable. */
  v?: string;
}

const manifest = manifestJson as unknown as Record<string, StockCoverEntry>;

export function readStockCoverManifest(): Record<string, StockCoverEntry> {
  return manifest ?? {};
}

export function getStockCoverEntry(slug: string): StockCoverEntry | null {
  return readStockCoverManifest()[slug] ?? null;
}

/**
 * URL pública de una portada stock con su versión de caché. Si el manifest no
 * conoce el slug o la entrada no tiene `v`, devuelve la URL tal cual: la ruta
 * la sigue sirviendo con el TTL corto de siempre.
 */
export function versionedStockCoverUrl(coverUrl: string | null | undefined): string | null {
  if (!coverUrl?.startsWith('/stock-covers/')) {
    return coverUrl ?? null;
  }
  const slug = coverUrl.slice('/stock-covers/'.length).split('?')[0];
  const entry = manifest[slug];
  return entry?.v ? `/stock-covers/${slug}?v=${entry.v}` : coverUrl;
}
