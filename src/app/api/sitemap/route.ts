import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSitemapXml, type SitemapEntry } from '@/lib/seo/sitemap';
import {
  hubAlternates,
  quizAlternates,
  sharedPathAlternates,
  type SlugIndex,
} from '@/lib/seo/sitemap-alternates';
import { newestIso } from '@/lib/seo/sitemap-dates';
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
 * Bilingual pairs are declared with `xhtml:link`, but only when the translated
 * page really exists. A category with quizzes in one language only has no page
 * in the other: `/{locale}/category/...` calls `notFound()`, so advertising it
 * as a hreflang alternate would send Google to a 404 announced by us.
 * `src/lib/seo/sitemap-alternates.ts` owns that decision and is unit tested.
 */

interface QuizRow {
  slug: string;
  language: string | null;
  published_at: string | null;
  updated_at: string | null;
  quiz_type: string | null;
  category_id: string | null;
  category: { slug: string | null } | null;
}

async function fetchPublishedQuizzes(): Promise<{ quizzes: QuizRow[]; failed: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quizzes')
      .select(
        'slug, language, published_at, updated_at, quiz_type, category_id, category:categories(slug)'
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50000);

    if (error) return { quizzes: [], failed: true };
    return { quizzes: (data ?? []) as unknown as QuizRow[], failed: false };
  } catch {
    return { quizzes: [], failed: true };
  }
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
  { path: '/faq', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
];

/** Quiz types that are exposed as their own hub page. */
const TYPE_HUBS = ['trivia', 'personality'];

export async function GET() {
  const { quizzes, failed } = await fetchPublishedQuizzes();

  // Un 200 con catálogo vacío desindexaría el sitio: mejor un 503 para que
  // Google reintente y conserve el último sitemap bueno.
  if (failed) {
    console.error('[sitemap] no se pudo leer el catálogo');
    return new NextResponse('sitemap unavailable', {
      status: 503,
      headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' },
    });
  }

  const perLocale = new Map<Locale, QuizRow[]>(locales.map((locale) => [locale, []]));
  const slugsByLocale: SlugIndex = new Map(locales.map((locale) => [locale, new Set<string>()]));
  /** Slugs con página `/{locale}/category/{slug}`, ya sea hub de tipo o categoría. */
  const hubSlugsByLocale: SlugIndex = new Map(locales.map((locale) => [locale, new Set<string>()]));
  const categoryHubs = new Map<
    string,
    { locale: Locale; slug: string; dates: Array<string | null> }
  >();
  const typeHubs = new Map<string, { locale: Locale; slug: string; dates: Array<string | null> }>();

  for (const quiz of quizzes) {
    const locale = (quiz.language === 'es' ? 'es' : 'en') as Locale;
    if (!quiz.slug) continue;
    perLocale.get(locale)?.push(quiz);
    slugsByLocale.get(locale)?.add(quiz.slug);

    if (quiz.quiz_type && TYPE_HUBS.includes(quiz.quiz_type)) {
      const key = `${locale}:type:${quiz.quiz_type}`;
      const hub = typeHubs.get(key) ?? { locale, slug: quiz.quiz_type, dates: [] };
      hub.dates.push(quiz.published_at, quiz.updated_at);
      typeHubs.set(key, hub);
      hubSlugsByLocale.get(locale)?.add(quiz.quiz_type);
    }

    const categorySlug = quiz.category?.slug;
    if (categorySlug) {
      const key = `${locale}:cat:${categorySlug}`;
      const hub = categoryHubs.get(key) ?? { locale, slug: categorySlug, dates: [] };
      hub.dates.push(quiz.published_at, quiz.updated_at);
      categoryHubs.set(key, hub);
      hubSlugsByLocale.get(locale)?.add(categorySlug);
    }
  }

  const entries: SitemapEntry[] = [];

  for (const locale of locales) {
    const localeQuizzes = perLocale.get(locale) ?? [];
    const localeNewest = newestIso(localeQuizzes.map((quiz) => quiz.published_at));

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
        lastModified: newestIso(hub.dates),
        changeFrequency: 'daily',
        priority: 0.8,
        alternates: hubAlternates(locale, hub.slug, hubSlugsByLocale),
      });
    }

    for (const hub of categoryHubs.values()) {
      if (hub.locale !== locale) continue;
      entries.push({
        url: `/${locale}/category/${hub.slug}`,
        lastModified: newestIso(hub.dates),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: hubAlternates(locale, hub.slug, hubSlugsByLocale),
      });
    }

    for (const quiz of localeQuizzes) {
      const other: Locale = locale === 'es' ? 'en' : 'es';
      entries.push({
        url: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}`,
        lastModified: newestIso([quiz.published_at, quiz.updated_at]),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: quizAlternates(
          locale,
          quiz.slug,
          getEquivalentQuizSlug(quiz.slug, other),
          slugsByLocale
        ),
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
