/**
 * llms.txt renderer — pure, no I/O.
 *
 * Produces the plain-text index served at /llms.txt for AI assistants
 * (ChatGPT, Perplexity, Copilot) so they have real URLs to cite: every
 * category/type hub with its quiz count plus the newest published quizzes,
 * per locale.
 */

import type { Locale } from '@/lib/i18n/dictionaries';
import { absoluteUrl, safePath } from './site';

export interface LlmsHub {
  name: string;
  slug: string;
  count: number;
}

export interface LlmsQuizEntry {
  title: string;
  slug: string;
}

export interface LlmsLocaleSection {
  locale: Locale;
  heading: string;
  hubs: LlmsHub[];
  newest: LlmsQuizEntry[];
}

export const LLMS_MAX_NEW = 30;

/** One line per item: llms.txt items must not contain raw newlines. */
function clean(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const PAGES: Array<{ path: string; label: Record<Locale, string>; note: Record<Locale, string> }> =
  [
    {
      path: '',
      label: { en: 'Home', es: 'Portada' },
      note: {
        en: 'Featured quizzes, categories and discovery.',
        es: 'Quizzes destacados, categorías y descubrimiento.',
      },
    },
    {
      path: '/quiz',
      label: { en: 'Quiz catalog', es: 'Catálogo de quizzes' },
      note: { en: 'Browse every published quiz.', es: 'Explora todos los quizzes publicados.' },
    },
    {
      path: '/leaderboard',
      label: { en: 'Leaderboard', es: 'Tabla de posiciones' },
      note: { en: 'Top players and rankings.', es: 'Mejores jugadores y clasificaciones.' },
    },
    {
      path: '/about',
      label: { en: 'About QuizVerse', es: 'Acerca de QuizVerse' },
      note: { en: 'What the site is and how it works.', es: 'Qué es el sitio y cómo funciona.' },
    },
    {
      path: '/faq',
      label: { en: 'FAQ', es: 'Preguntas frecuentes' },
      note: { en: 'Frequently asked questions.', es: 'Preguntas frecuentes.' },
    },
    {
      path: '/contact',
      label: { en: 'Contact', es: 'Contacto' },
      note: { en: 'Contact page.', es: 'Página de contacto.' },
    },
    {
      path: '/privacy',
      label: { en: 'Privacy policy', es: 'Política de privacidad' },
      note: { en: 'Data handling and cookies.', es: 'Tratamiento de datos y cookies.' },
    },
    {
      path: '/terms',
      label: { en: 'Terms of service', es: 'Términos de servicio' },
      note: { en: 'Usage terms.', es: 'Condiciones de uso.' },
    },
  ];

/** Renders one locale block: `## <heading>` + Hubs / New quizzes / Pages. */
export function renderLlmsTxt(section: LlmsLocaleSection): string {
  const { locale, heading, hubs, newest } = section;
  const lines: string[] = [`## ${clean(heading)}`, ''];

  if (hubs.length > 0) {
    lines.push('### Hubs', '');
    for (const hub of hubs) {
      const url = absoluteUrl(`/${locale}/category/${safePath(hub.slug)}`);
      lines.push(`- [${clean(hub.name)}](${url}): ${Math.max(0, hub.count)} quizzes`);
    }
    lines.push('');
  }

  const entries = newest.slice(0, LLMS_MAX_NEW);
  if (entries.length > 0) {
    lines.push('### New quizzes', '');
    for (const quiz of entries) {
      const url = absoluteUrl(`/${locale}/quiz/${safePath(quiz.slug)}`);
      lines.push(`- [${clean(quiz.title)}](${url})`);
    }
    lines.push('');
  }

  lines.push('### Pages', '');
  for (const page of PAGES) {
    const url = absoluteUrl(`/${locale}${page.path}`);
    lines.push(`- [${page.label[locale]}](${url}): ${page.note[locale]}`);
  }
  lines.push(
    `- [Sitemap](${absoluteUrl('/sitemap.xml')}): ${
      locale === 'es'
        ? 'Índice exhaustivo de todos los quizzes y hubs publicados.'
        : 'Exhaustive index of every published quiz and hub.'
    }`
  );

  return lines.join('\n');
}

/** Full document: title, bilingual tagline, then each locale section. */
export function renderLlmsDocument(sections: LlmsLocaleSection[]): string {
  const header = [
    '# QuizVerse',
    '',
    '> QuizVerse is a free, bilingual (English/Spanish) quiz site with trivia and personality quizzes — no sign-up required to play. / QuizVerse es un sitio gratuito y bilingüe (inglés/español) de quizzes de trivia y personalidad, sin registro para jugar.',
    '',
  ];
  return header.concat(sections.map(renderLlmsTxt)).join('\n');
}
