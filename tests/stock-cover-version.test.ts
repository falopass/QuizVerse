/**
 * La URL pública de una portada stock lleva `?v=<hash>`: la ruta la sirve con
 * caché inmutable de un año solo si esa versión coincide con la entrada del
 * manifest. Estas pruebas fijan el contrato entre el manifest generado
 * (scripts/hydrate-stock-covers.mjs) y el data layer.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/data/public', () => ({ getQuizBySlug: vi.fn() }));

import manifestJson from '@/lib/data/stock-cover-manifest.json';
import { versionedStockCoverUrl } from '@/lib/data/stock-cover-manifest';
import { stockImageVariantUrl } from '@/app/stock-covers/[slug]/route';

const manifest = manifestJson as Record<
  string,
  { image_url: string; v?: string; provider: string }
>;

describe('stock-cover-manifest (artefacto generado)', () => {
  it('toda entrada nace en la variante servida por la ruta y con versión', () => {
    for (const [slug, entry] of Object.entries(manifest)) {
      expect(entry.image_url, slug).toBe(stockImageVariantUrl(entry.image_url));
      expect(entry.v, slug).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});

describe('versionedStockCoverUrl', () => {
  it('añade ?v= del manifest a una portada stock conocida', () => {
    const [slug, entry] = Object.entries(manifest)[0];
    expect(versionedStockCoverUrl(`/stock-covers/${slug}`)).toBe(
      `/stock-covers/${slug}?v=${entry.v}`
    );
  });

  it('deja intacta una portada stock sin entrada en el manifest', () => {
    expect(versionedStockCoverUrl('/stock-covers/slug-borrado')).toBe('/stock-covers/slug-borrado');
  });

  it('deja intactas portadas procedurales, URLs externas y null', () => {
    expect(versionedStockCoverUrl('/covers/quiz-uno')).toBe('/covers/quiz-uno');
    expect(versionedStockCoverUrl('https://cdn.ejemplo.com/x.png')).toBe(
      'https://cdn.ejemplo.com/x.png'
    );
    expect(versionedStockCoverUrl(null)).toBeNull();
  });
});
