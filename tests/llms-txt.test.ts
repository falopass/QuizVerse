import { describe, expect, it } from 'vitest';
import {
  LLMS_MAX_NEW,
  renderLlmsDocument,
  renderLlmsTxt,
  type LlmsHub,
  type LlmsLocaleSection,
} from '@/lib/seo/llms';
import { SITE_URL } from '@/lib/seo/site';

const section = (overrides: Partial<LlmsLocaleSection> = {}): LlmsLocaleSection => ({
  locale: 'es',
  heading: 'Español',
  hubs: [],
  newest: [],
  ...overrides,
});

const hubs: LlmsHub[] = [
  { name: 'Cine y TV', slug: 'movies-tv', count: 174 },
  { name: 'Anime y manga', slug: 'anime-manga', count: 119 },
];

describe('renderLlmsTxt', () => {
  it('lista cada hub con su conteo y URL absoluta', () => {
    const out = renderLlmsTxt(section({ hubs }));
    expect(out).toContain(`- [Cine y TV](${SITE_URL}/es/category/movies-tv): 174 quizzes`);
    expect(out).toContain(`- [Anime y manga](${SITE_URL}/es/category/anime-manga): 119 quizzes`);
  });

  it('corta la lista de nuevos en 30', () => {
    const newest = Array.from({ length: 45 }, (_, i) => ({
      title: `Quiz ${i + 1}`,
      slug: `quiz-${i + 1}`,
    }));
    const out = renderLlmsTxt(section({ newest }));
    const lines = out.split('\n').filter((line) => line.includes('/es/quiz/quiz-'));
    expect(lines).toHaveLength(LLMS_MAX_NEW);
    expect(out).toContain(`quiz-${LLMS_MAX_NEW})`);
    expect(out).not.toContain(`quiz-${LLMS_MAX_NEW + 1})`);
  });

  it('usa URLs absolutas para hubs, quizzes y páginas', () => {
    const out = renderLlmsTxt(
      section({ hubs, newest: [{ title: 'Nuevo', slug: 'nuevo' }] })
    );
    expect(out).toContain(`${SITE_URL}/es/category/movies-tv`);
    expect(out).toContain(`${SITE_URL}/es/quiz/nuevo`);
    expect(out).toContain(`${SITE_URL}/es/about`);
    expect(out).toContain(`${SITE_URL}/sitemap.xml`);
    expect(out).not.toMatch(/\]\(\//);
  });

  it('no emite secciones vacías', () => {
    const out = renderLlmsTxt(section({ hubs, newest: [] }));
    expect(out).not.toContain('### New quizzes');
    expect(out).toContain('### Hubs');
    expect(out).toContain('### Pages');
  });

  it('con hubs y newest vacíos el documento sigue siendo válido', () => {
    const out = renderLlmsDocument([section(), section({ locale: 'en', heading: 'English' })]);
    expect(out).toContain('# QuizVerse');
    expect(out).toContain('## Español');
    expect(out).toContain('## English');
    expect(out).not.toContain('### Hubs');
    expect(out).not.toContain('### New quizzes');
    expect(out).toContain('### Pages');
    expect(out).toContain(`${SITE_URL}/sitemap.xml`);
  });

  it('normaliza saltos de línea dentro de un ítem', () => {
    const out = renderLlmsTxt(
      section({
        hubs: [{ name: 'Cine\ny TV', slug: 'movies-tv', count: 1 }],
        newest: [{ title: 'Quiz\nmultilínea', slug: 'multi' }],
      })
    );
    expect(out).toContain('- [Cine y TV]');
    expect(out).toContain('- [Quiz multilínea]');
    expect(out).not.toMatch(/\[[^\]]*\n/);
  });
});
