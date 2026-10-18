export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
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

      return `  <url>${parts.join('')}</url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function generateSitemapIndexXml(sitemapUrls: string[]): string {
  const items = sitemapUrls
    .map((url) => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>
`;
}

export default generateSitemapXml;
