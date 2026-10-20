export interface SitemapAlternate {
  /** Código hreflang: `en`, `es` o `x-default`. */
  hreflang: string;
  /** Ruta absoluta del idioma alterno, sin dominio. */
  href: string;
}

export interface SitemapImage {
  /** URL absoluta de la imagen. */
  url: string;
  title?: string;
  caption?: string;
}

export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  /**
   * Versiones del mismo contenido en otros idiomas.
   *
   * Declararlas en el sitemap ahorra un salto: Google descubre la pareja
   * en↔es sin rastrear primero la página para leer su `<link rel="alternate">`.
   * Solo se emiten cuando el equivalente existe de verdad.
   */
  alternates?: SitemapAlternate[];
  /**
   * Imágenes de la página, con URL absoluta (extensión image sitemaps).
   * Permite a Google Imágenes descubrir las portadas sin rastrear la ficha.
   */
  images?: SitemapImage[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serializes URL entries into a sitemap document.
 *
 * `lastmod` is only emitted when the value parses as a real datetime: Google
 * ignores the hint entirely when it finds an unparseable value, so an invalid
 * date is worse than no date at all.
 */
export function generateSitemapXml(entries: SitemapEntry[], baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');

  const urls = entries
    .map((entry) => {
      const loc = escapeXml(`${base}${entry.url}`);
      const parts = [`<loc>${loc}</loc>`];

      if (entry.lastModified) {
        const parsed = new Date(entry.lastModified);
        if (!Number.isNaN(parsed.getTime())) {
          parts.push(`<lastmod>${parsed.toISOString()}</lastmod>`);
        }
      }
      if (entry.changeFrequency) {
        parts.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
      }
      if (typeof entry.priority === 'number') {
        parts.push(`<priority>${entry.priority.toFixed(1)}</priority>`);
      }
      for (const image of entry.images ?? []) {
        const imageParts = [`<image:loc>${escapeXml(image.url)}</image:loc>`];
        if (image.title) imageParts.push(`<image:title>${escapeXml(image.title)}</image:title>`);
        if (image.caption)
          imageParts.push(`<image:caption>${escapeXml(image.caption)}</image:caption>`);
        parts.push(`<image:image>${imageParts.join('')}</image:image>`);
      }
      for (const alternate of entry.alternates ?? []) {
        parts.push(
          `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(
            `${base}${alternate.href}`
          )}"/>`
        );
      }

      return `  <url>${parts.join('')}</url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

export default generateSitemapXml;
