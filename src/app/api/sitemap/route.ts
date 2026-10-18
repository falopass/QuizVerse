import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSitemapXml, type SitemapAlternate, type SitemapEntry } from '@/lib/seo/sitemap';
import { SITE_URL } from '@/lib/seo/site';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { locales, type Locale } from '@/lib/i18n/dictionaries';

/**
 * Served at /sitemap.xml through a rewrite in next.config.ts.
 *
 * The sitemap only lists URLs that are indexable, self-canonical and actually
 * render content: every published quiz in its own language, every category and
 * quiz type that has at least one quiz in that language, and the editorial
 * pages. Login-gated tools (/create) and personalized views (/play, /result)
 * are intentionally absent.
 *
 * Bilingual pairs are declared inline with `xhtml:link`, but only when the
 * translated page really exists: a hreflang pointing at a 404 is worse than no
 * hreflang at all.
 */

interface QuizRow {
  slug: string;
  language: string | null;
  published_at: string | null;
  quiz_type: string | null;
  category_id: string | null;
  category: { slug: string | null } | null;
}

async function fetchPublishedQuizzes(): Promise<QuizRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quizzes')
      .select('slug, language, published_at, quiz_type, category_id, category:categories(slug)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50000);

    if (error || !data) return [];
    return data as unknown as QuizRow[];
  } catch {
    return [];
  }
}

function newest(dates: Array<string | null | undefined>): string | undefined {
  let best: number | undefined;
  let bestIso: string | undefined;

  for (const value of dates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    if (best === undefined || time > best) {
      best = time;
      bestIso = value;
    }
  }

  return bestIso;
}

/** Alternates de una página que existe en ambos idiomas con la misma ruta. */
function sharedPathAlternates(path: string): SitemapAlternate[] {
  const en = `/en${path}`;
  const es = `/es${path}`;
  return [
    { hreflang: 'en', href: en },
    { hreflang: 'es', href: es },
    { hreflang: 'x-default', href: en },
  ];
}

const EDITORIAL_PAGES: Array<{
  path: string;
  priority: number;
  changeFrequency: SitemapEntry['changeFrequency'];
}> = [
  { path: '', priority: 1.0, changeFrequency: 'daily' },
  { path: '/quiz', priority: 0.9, changeFrequency: 'daily' },
  { path: '/leaderboard', priority: 0.4, changeFrequency: 'daily' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
];

/** Quiz types that are exposed as their own hub page. */
const TYPE_HUBS = ['trivia', 'personality'];

export async function GET() {
  const quizzes = await fetchPublishedQuizzes();

  const perLocale = new Map<Locale, QuizRow[]>(locales.map((locale) => [locale, []]));
  const slugsByLocale = new Map<Locale, Set<string>>(locales.map((locale) => [locale, new Set()]));
  const categoryHubs = new Map<string, { locale: Locale; slug: string; dates: string[] }>();
  const typeHubs = new Map<string, { locale: Locale; slug: string; dates: string[] }>();

  for (const quiz of quizzes) {
    const locale = (quiz.language === 'es' ? 'es' : 'en') as Locale;
    if (!quiz.slug) continue;
    perLocale.get(locale)?.push(quiz);
    slugsByLocale.get(locale)?.add(quiz.slug);

    const date = quiz.published_at;

    if (quiz.quiz_type && TYPE_HUBS.includes(quiz.quiz_type)) {
      const key = `${locale}:type:${quiz.quiz_type}`;
      const hub = typeHubs.get(key) ?? { locale, slug: quiz.quiz_type, dates: [] };
      hub.dates.push(date ?? '');
      typeHubs.set(key, hub);
    }

    const categorySlug = quiz.category?.slug;
    if (categorySlug) {
      const key = `${locale}:cat:${categorySlug}`;
      const hub = categoryHubs.get(key) ?? { locale, slug: categorySlug, dates: [] };
      hub.dates.push(date ?? '');
      categoryHubs.set(key, hub);
    }
  }

  /**
   * Alternates de un quiz: sólo si el mapa de traducciones conoce la pareja y
   * esa pareja está publicada. Se comparan slugs reales, no la intención.
   */
  function quizAlternates(locale: Locale, slug: string): SitemapAlternate[] | undefined {
    const other: Locale = locale === 'es' ? 'en' : 'es';
    const counterpart = getEquivalentQuizSlug(slug, other);
    if (!counterpart) return undefined;
    if (!slugsByLocale.get(other)?.has(counterpart)) return undefined;

    const self = `/${locale}/quiz/${encodeURIComponent(slug)}`;
    const translated = `/${other}/quiz/${encodeURIComponent(counterpart)}`;

    return [
      { hreflang: locale, href: self },
      { hreflang: other, href: translated },
      { hreflang: 'x-default', href: locale === 'en' ? self : translated },
    ];
  }

  const entries: SitemapEntry[] = [];

  for (const locale of locales) {
    const localeQuizzes = perLocale.get(locale) ?? [];
    const localeNewest = newest(localeQuizzes.map((quiz) => quiz.published_at));

    for (const page of EDITORIAL_PAGES) {
      entries.push({
        url: `/${locale}${page.path}`,
        lastModified: page.path === '' ? localeNewest : undefined,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: sharedPathAlternates(page.path),
      });
    }

    // Quiz type hubs (trivia / personality) — the strongest landing pages.
    for (const hub of typeHubs.values()) {
      if (hub.locale !== locale) continue;
      entries.push({
        url: `/${locale}/category/${hub.slug}`,
        lastModified: newest(hub.dates),
        changeFrequency: 'daily',
        priority: 0.8,
        alternates: sharedPathAlternates(`/category/${hub.slug}`),
      });
    }

    for (const hub of categoryHubs.values()) {
      if (hub.locale !== locale) continue;
      entries.push({
        url: `/${locale}/category/${hub.slug}`,
        lastModified: newest(hub.dates),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: sharedPathAlternates(`/category/${hub.slug}`),
      });
    }

    for (const quiz of localeQuizzes) {
      entries.push({
        url: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}`,
        lastModified: quiz.published_at ?? undefined,
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: quizAlternates(locale, quiz.slug),
      });
    }
  }

  // De-duplicate: a hub can be reached both as a type and as a category.
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });

  const xml = generateSitemapXml(unique, SITE_URL);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
