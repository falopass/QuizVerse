import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSitemapXml, type SitemapEntry } from '@/lib/seo/sitemap';
import {
  fandomAlternates,
  hubAlternates,
  quizAlternates,
  sharedPathAlternates,
  type SlugIndex,
} from '@/lib/seo/sitemap-alternates';
import { newestIso, quizLastModified } from '@/lib/seo/sitemap-dates';
import { SITE_URL } from '@/lib/seo/site';
import { buildFandomHubs, pairedFandomSlug } from '@/lib/content/franchise';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { versionedStockCoverUrl } from '@/lib/data/stock-cover-manifest';
import { locales, type Locale } from '@/lib/i18n/dictionaries';

/**
 * Served at /sitemap.xml through a rewrite in next.config.ts.
 *
 * The sitemap only lists URLs that are indexable, self-canonical and actually
 * render content: every published quiz in its own language, every category and
 * quiz type that has at least one quiz in that language, every fandom hub
 * (franchise group with at least three quizzes in that language), and the
 * editorial pages. Login-gated tools (/create) and personalized views
 * (/play, /result) are intentionally absent.
 *
 * Bilingual pairs are declared with `xhtml:link`, but only when the translated
 * page really exists. A category with quizzes in one language only has no page
 * in the other: `/{locale}/category/...` calls `notFound()`, so advertising it
 * as a hreflang alternate would send Google to a 404 announced by us.
 * `src/lib/seo/sitemap-alternates.ts` owns that decision and is unit tested.
 *
 * `lastmod` es el último cambio real de contenido de cada quiz (edición
 * posterior a la inserción, con `published_at` de respaldo) y el máximo de sus
 * quizzes en los hubs. El `updated_at` que dejó el import masivo coincide con
 * `created_at` y no es una edición; sin fecha fiable la URL va sin `<lastmod>`.
 * `src/lib/seo/sitemap-dates.ts` owns that decision and is unit tested.
 */

interface QuizRow {
  slug: string;
  title: string | null;
  cover_image_url: string | null;
  language: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  quiz_type: string | null;
  category_id: string | null;
  category: { slug: string | null } | null;
}

// PostgREST corta cada respuesta en `max-rows` (1000 por defecto): un `limit(50000)`
// devuelve solo 1000 filas sin avisar, así que el sitemap perdía en silencio todo lo
// que pasaba de ese tope. Se pagina con `range`; el orden incluye `slug` (único)
// porque muchos quizzes comparten `published_at` y un orden con empates repite u
// omite filas entre páginas.
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

async function fetchPublishedQuizzes(): Promise<{ quizzes: QuizRow[]; failed: boolean }> {
  try {
    const supabase = await createClient();
    const quizzes: QuizRow[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('quizzes')
        .select(
          'slug, title, cover_image_url, language, published_at, created_at, updated_at, quiz_type, category_id, category:categories(slug)'
        )
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .order('slug', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error || !data) return { quizzes: [], failed: true };
      quizzes.push(...(data as unknown as QuizRow[]));
      if (data.length < PAGE_SIZE) break;
    }

    // Con cientos de quizzes publicados, `data: []` es un fallo silencioso
    // (select roto, RLS, filtro mal escrito), no un catálogo real.
    if (quizzes.length === 0) return { quizzes: [], failed: true };
    return { quizzes, failed: false };
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
  { path: '/novedades', priority: 0.6, changeFrequency: 'daily' },
  { path: '/leaderboard', priority: 0.4, changeFrequency: 'daily' },
  { path: '/indice', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/widget', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
];

/** Quiz types that are exposed as their own hub page. */
const TYPE_HUBS = ['trivia', 'personality'];

/**
 * URL absoluta de la portada de un quiz, para `image:image` del sitemap.
 * Las stock covers ya tienen su ruta servible; el resto cae en la portada
 * procedural `/covers/[slug]`, que siempre existe.
 */
export function quizCoverImageUrl(quiz: Pick<QuizRow, 'slug' | 'cover_image_url'>): string {
  const path = quiz.cover_image_url?.startsWith('/stock-covers/')
    ? versionedStockCoverUrl(quiz.cover_image_url)
    : `/covers/${encodeURIComponent(quiz.slug)}`;
  return `${SITE_URL}${path}`;
}

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
    { locale: Locale; slug: string; dates: Array<string | undefined> }
  >();
  const typeHubs = new Map<
    string,
    { locale: Locale; slug: string; dates: Array<string | undefined> }
  >();

  /** Último cambio de contenido por quiz; cada hub toma el máximo de los suyos. */
  const lastModifiedBySlug = new Map<string, string | undefined>();

  for (const quiz of quizzes) {
    const locale = (quiz.language === 'es' ? 'es' : 'en') as Locale;
    if (!quiz.slug) continue;
    perLocale.get(locale)?.push(quiz);
    slugsByLocale.get(locale)?.add(quiz.slug);
    const lastModified = quizLastModified(quiz);
    lastModifiedBySlug.set(quiz.slug, lastModified);

    if (quiz.quiz_type && TYPE_HUBS.includes(quiz.quiz_type)) {
      const key = `${locale}:type:${quiz.quiz_type}`;
      const hub = typeHubs.get(key) ?? { locale, slug: quiz.quiz_type, dates: [] };
      hub.dates.push(lastModified);
      typeHubs.set(key, hub);
      hubSlugsByLocale.get(locale)?.add(quiz.quiz_type);
    }

    const categorySlug = quiz.category?.slug;
    if (categorySlug) {
      const key = `${locale}:cat:${categorySlug}`;
      const hub = categoryHubs.get(key) ?? { locale, slug: categorySlug, dates: [] };
      hub.dates.push(lastModified);
      categoryHubs.set(key, hub);
      hubSlugsByLocale.get(locale)?.add(categorySlug);
    }
  }

  // Hubs de fandom por idioma: los quizzes se agrupan por la franquicia que
  // anuncia su título (ver src/lib/content/franchise.ts); solo existen los
  // grupos con ≥3 miembros, igual que la página. La pareja hreflang se decide
  // por votación de los pares del mapa de idiomas — los slugs no se traducen.
  const fandomHubsByLocale = {
    en: buildFandomHubs(
      (perLocale.get('en') ?? []).filter((quiz): quiz is QuizRow & { title: string } =>
        Boolean(quiz.title)
      ),
      'en'
    ),
    es: buildFandomHubs(
      (perLocale.get('es') ?? []).filter((quiz): quiz is QuizRow & { title: string } =>
        Boolean(quiz.title)
      ),
      'es'
    ),
  };

  const entries: SitemapEntry[] = [];

  for (const locale of locales) {
    const localeQuizzes = perLocale.get(locale) ?? [];
    const localeNewest = newestIso(localeQuizzes.map((quiz) => lastModifiedBySlug.get(quiz.slug)));

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

    for (const hub of fandomHubsByLocale[locale].values()) {
      const paired = pairedFandomSlug(fandomHubsByLocale, locale, hub.slug, getEquivalentQuizSlug);
      entries.push({
        url: `/${locale}/fandom/${hub.slug}`,
        lastModified: newestIso(hub.quizzes.map((quiz) => lastModifiedBySlug.get(quiz.slug))),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: fandomAlternates(locale, hub.slug, paired),
      });
    }

    for (const quiz of localeQuizzes) {
      const other: Locale = locale === 'es' ? 'en' : 'es';
      entries.push({
        url: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}`,
        lastModified: lastModifiedBySlug.get(quiz.slug),
        changeFrequency: 'weekly',
        priority: 0.7,
        images: [{ url: quizCoverImageUrl(quiz), title: quiz.title ?? undefined }],
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
