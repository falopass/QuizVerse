import { describe, expect, it } from 'vitest';
import { checkHtml, findCopyBugs, parseSitemap } from '../scripts/seo-check.mjs';

const URL = 'https://quizverse.org/es';

const HEAD = `
  <title>QuizVerse — Quizzes gratuitos en español</title>
  <meta name="description" content="Juega quizzes gratis de películas, anime, música y más. Trivia y tests de personalidad, sin registro y en tu idioma." />
  <link rel="canonical" href="https://quizverse.org/es" />
  <link rel="alternate" hreflang="en" href="https://quizverse.org/en" />
  <link rel="alternate" hreflang="es" href="https://quizverse.org/es" />
  <link rel="alternate" hreflang="x-default" href="https://quizverse.org/en" />
  <meta property="og:image" content="https://quizverse.org/og/home.png" />
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"}]}</script>`;

function page(head = HEAD, body = '<h1>Explora el universo de quizzes</h1>') {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

function codes(findings: { code: string }[]) {
  return findings.map((f) => f.code);
}

describe('parseSitemap', () => {
  it('extrae <loc> absolutos sin duplicados', () => {
    const xml = `<urlset>
      <url><loc>https://quizverse.org/en</loc></url>
      <url><loc> https://quizverse.org/es </loc></url>
      <url><loc>https://quizverse.org/en</loc></url>
      <url><loc>/relativa</loc></url>
    </urlset>`;
    expect(parseSitemap(xml)).toEqual(['https://quizverse.org/en', 'https://quizverse.org/es']);
  });
});

describe('checkHtml', () => {
  it('página válida: 0 hallazgos', () => {
    expect(checkHtml(page(), URL)).toEqual([]);
  });

  it('status distinto de 200 corta el resto', () => {
    const f = checkHtml('<html></html>', URL, 500);
    expect(codes(f)).toEqual(['http-status']);
  });

  it('detecta dos <h1>', () => {
    const f = checkHtml(
      page(HEAD, '<h1>Cargando el universo de quizzes...</h1><h1>Real</h1>'),
      URL
    );
    expect(codes(f)).toContain('h1-count');
  });

  it('detecta <h1> del esqueleto de carga', () => {
    const f = checkHtml(page(HEAD, '<h1>Cargando el universo de quizzes...</h1>'), URL);
    expect(codes(f)).toContain('h1-skeleton');
  });

  it('detecta <title> corto y largo', () => {
    const short = checkHtml(page('<title>Corto</title>'), URL);
    expect(codes(short)).toContain('title-length');
    const long = checkHtml(page(`<title>${'x'.repeat(80)}</title>`), URL);
    expect(codes(long)).toContain('title-length');
  });

  it('detecta canonical ausente y de otra URL', () => {
    const head = (c: string) => HEAD.replace(/<link rel="canonical"[^>]*>/, c);
    expect(codes(checkHtml(page(head('')), URL))).toContain('canonical-missing');
    const wrong = checkHtml(
      page(head('<link rel="canonical" href="https://quizverse.org/en" />')),
      URL
    );
    expect(codes(wrong)).toContain('canonical-mismatch');
  });

  it('acepta canonical con barra final equivalente', () => {
    const head = HEAD.replace('https://quizverse.org/es"', 'https://quizverse.org/es/"');
    expect(codes(checkHtml(page(head), URL))).not.toContain('canonical-mismatch');
  });

  it('detecta hreflang incompleto y relativo', () => {
    const head =
      HEAD.replace(/<link rel="alternate"[^>]*>/g, '') +
      '<link rel="alternate" hreflang="en" href="/en" />';
    const f = checkHtml(page(head), URL);
    expect(codes(f)).toContain('hreflang-incomplete');
    expect(codes(f)).toContain('hreflang-relative');
  });

  it('detecta JSON-LD inválido y sin @graph', () => {
    const bad = HEAD.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      '<script type="application/ld+json">{not json</script>'
    );
    expect(codes(checkHtml(page(bad), URL))).toContain('jsonld-invalid');
    const noGraph = HEAD.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>'
    );
    expect(codes(checkHtml(page(noGraph), URL))).toContain('jsonld-shape');
  });

  it('detecta og:image relativo', () => {
    const head = HEAD.replace('https://quizverse.org/og/home.png', '/og/home.png');
    expect(codes(checkHtml(page(head), URL))).toContain('og-image-relative');
  });
});

describe('findCopyBugs', () => {
  it('detecta «1 quizzes» en texto visible', () => {
    const f = findCopyBugs(page(HEAD, '<p>1 quizzes online</p>'));
    expect(codes(f)).toContain('copy-bug');
  });

  it('ignora undefined dentro de <script>', () => {
    expect(findCopyBugs(page(HEAD, '<script>var x = undefined;</script>'))).toEqual([]);
  });
});
