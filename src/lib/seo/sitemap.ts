export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export function generateSitemapXml(entries: SitemapEntry[], baseUrl: string): string {
  const xml = entries
    .map((entry) => {
      return `
  <url>
    <loc>${baseUrl}${entry.url}</loc>
    ${entry.lastModified ? `<lastmod>${entry.lastModified}</lastmod>` : ''}
    ${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ''}
    ${entry.priority ? `<priority>${entry.priority.toFixed(1)}</priority>` : ''}
  </url>`.trim();
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xml}
</urlset>`;
}

export function generateSitemapIndexXml(sitemapUrls: string[]): string {
  const xml = sitemapUrls
    .map((url) => {
      return `
  <sitemap>
    <loc>${url}</loc>
  </sitemap>`.trim();
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xml}
</sitemapindex>`;
}

export async function fetchQuizzesForSitemap(supabase: unknown, limit = 50000, offset = 0) {
  // This would use Supabase client to fetch published quizzes
  // Implementation depends on your Supabase setup
  return [];
}

export default generateSitemapXml;
