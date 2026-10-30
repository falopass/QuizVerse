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
}

const manifest = manifestJson as unknown as Record<string, StockCoverEntry>;

export function readStockCoverManifest(): Record<string, StockCoverEntry> {
  return manifest ?? {};
}

export function getStockCoverEntry(slug: string): StockCoverEntry | null {
  return readStockCoverManifest()[slug] ?? null;
}
