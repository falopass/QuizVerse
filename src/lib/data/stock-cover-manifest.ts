import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

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

const manifestPath = path.join(process.cwd(), 'src', 'lib', 'data', 'stock-cover-manifest.json');

export function readStockCoverManifest(): Record<string, StockCoverEntry> {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as Record<string, StockCoverEntry>;
  } catch {
    return {};
  }
}

export function getStockCoverEntry(slug: string): StockCoverEntry | null {
  const manifest = readStockCoverManifest();
  return manifest[slug] ?? null;
}
