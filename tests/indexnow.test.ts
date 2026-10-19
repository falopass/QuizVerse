import { describe, expect, it } from 'vitest';
import { changedSince, parseSitemapEntries } from '../scripts/submit-indexnow.mjs';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://quizverse.org/en/quiz/no-lastmod</loc>
  </url>
  <url>
    <loc>https://quizverse.org/en/quiz/old</loc>
    <lastmod>2026-01-15T00:00:00Z</lastmod>
  </url>
  <url>
    <loc>https://quizverse.org/en/quiz/new</loc>
    <lastmod>2026-10-18T12:00:00Z</lastmod>
  </url>
</urlset>`;

describe('parseSitemapEntries', () => {
  it('returns every entry with url and lastmod when present', () => {
    const entries = parseSitemapEntries(XML);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      url: 'https://quizverse.org/en/quiz/no-lastmod',
      lastmod: undefined,
    });
    expect(entries[1]).toEqual({
      url: 'https://quizverse.org/en/quiz/old',
      lastmod: '2026-01-15T00:00:00Z',
    });
    expect(entries[2]).toEqual({
      url: 'https://quizverse.org/en/quiz/new',
      lastmod: '2026-10-18T12:00:00Z',
    });
  });

  it('returns an empty array for empty XML', () => {
    expect(parseSitemapEntries('')).toEqual([]);
    expect(parseSitemapEntries('<urlset></urlset>')).toEqual([]);
  });
});

describe('changedSince', () => {
  it('returns only entries modified after the given date', () => {
    const entries = parseSitemapEntries(XML);
    const changed = changedSince(entries, '2026-10-01T00:00:00Z');
    expect(changed).toEqual([
      { url: 'https://quizverse.org/en/quiz/new', lastmod: '2026-10-18T12:00:00Z' },
    ]);
  });

  it('never reports entries without lastmod as changed', () => {
    const entries = parseSitemapEntries(XML);
    const changed = changedSince(entries, '2000-01-01T00:00:00Z');
    expect(changed.map((entry: { url: string }) => entry.url)).not.toContain(
      'https://quizverse.org/en/quiz/no-lastmod'
    );
    expect(changed).toHaveLength(2);
  });
});
