import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExploreEditorialPage } from '@/components/home/explore-editorial-page';
import { JsonLd } from '@/components/seo/json-ld';
import { getExplorePayload, getLaunchExplorePayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { explorerVisibleQuizzes } from '@/lib/quiz/editorial-order';
import { toExploreCard } from '@/lib/quiz/explore-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { buildGraph, itemListNode, quizPath, webPageNode } from '@/lib/seo/structured-data';

const EXPLORER_TITLE: Record<Locale, string> = {
  es: 'Explora todos los quizzes — trivia, personalidad y fandom',
  en: 'Explore all quizzes — trivia, personality and fandom',
};

/** How many quizzes the ItemList advertises. Keeps the JSON-LD payload small. */
const ITEM_LIST_LIMIT = 24;

/**
 * Tarjetas iniciales enviadas en el HTML/RSC de la primera carga (hero, pulso,
 * 4 carriles y 18 tarjetas de grilla = 24 quizzes). El resto se pagina y busca
 * bajo demanda contra `GET /api/quizzes`.
 */
const INITIAL_EXPLORE_LIMIT = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  return buildMetadata({
    title: EXPLORER_TITLE[locale],
    description:
      locale === 'es'
        ? 'Explora el catálogo completo de QuizVerse por tema, ánimo y ritmo. Trivia, tests de personalidad y retos de fandom gratis.'
        : 'Browse the full QuizVerse catalog by topic, mood and pace. Free trivia rounds, personality tests and fandom challenges.',
    path: `/${locale}/quiz`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/quiz`,
    locale,
    image: absoluteUrl(`/${locale}/quiz/opengraph-image`),
  });
}

export default async function LocalizedQuizExplorerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  // Igual que la home y la ficha: si el payload falla entero se sirve el
  // catálogo de lanzamiento, no la página de error.
  const payload = await getExplorePayload(locale).catch(() => getLaunchExplorePayload(locale));

  // El catálogo es un componente cliente, así que cada objeto cruza al payload
  // RSC. Enviamos solo las primeras 24 tarjetas de la selección editorial en
  // la primera carga; el resto y las búsquedas sobre el catálogo completo se
  // piden a `GET /api/quizzes`.
  const totalQuizzes = payload.quizzes.length;
  const initialSelection =
    totalQuizzes > INITIAL_EXPLORE_LIMIT
      ? explorerVisibleQuizzes(payload.quizzes).slice(0, INITIAL_EXPLORE_LIMIT)
      : payload.quizzes;
  const quizzes = initialSelection.map(toExploreCard);
  const isFallback = 'isFallback' in payload && Boolean(payload.isFallback);

  return (
    <>
      <JsonLd
        data={buildGraph([
          webPageNode(`/${locale}/quiz`, locale, EXPLORER_TITLE[locale]),
          itemListNode(
            payload.quizzes
              .slice(0, ITEM_LIST_LIMIT)
              .map((quiz) => ({ name: quiz.title, path: quizPath(locale, quiz.slug) })),
            locale
          ),
        ])}
      />
      <ExploreEditorialPage
        locale={locale}
        quizzes={quizzes}
        categories={payload.categories}
        totalQuizzes={totalQuizzes}
        isFallback={isFallback}
        copy={{
          title: dictionary.explore.title,
          subtitle: dictionary.explore.subtitle,
          searchPlaceholder: dictionary.explore.searchPlaceholder,
          emptyTitle: dictionary.explore.emptyTitle,
          emptyBody: dictionary.explore.emptyBody,
          allCategories: dictionary.explore.allCategories,
          searchLabel: locale === 'es' ? 'Buscar' : 'Search',
          categoryLanes: locale === 'es' ? 'Carriles de categoría' : 'Category lanes',
          moreWaysIn: locale === 'es' ? 'Más caminos de entrada' : 'More ways in',
          quizzesAfterFilters: locale === 'es' ? 'quizzes tras filtros' : 'quizzes after filters',
          clearFilters: locale === 'es' ? 'Limpiar filtros' : 'Clear filters',
          loadingMore: locale === 'es' ? 'Cargando quizzes…' : 'Loading quizzes…',
          loadError:
            locale === 'es'
              ? 'No pudimos cargar el catálogo remoto. Inténtalo de nuevo.'
              : 'We could not load the remote catalog. Please try again.',
          retry: dictionary.error?.retry ?? (locale === 'es' ? 'Reintentar' : 'Try again'),
          fallbackNoticeTitle:
            locale === 'es'
              ? 'Catálogo en modo de respaldo (solo lectura)'
              : 'Catalog in read-only fallback mode',
          fallbackNoticeBody:
            locale === 'es'
              ? 'Mostramos la selección base mientras se recupera la conexión. Las partidas que requieren guardar puntaje o ranking volverán a estar disponibles en breve.'
              : 'Showing the base selection while the connection recovers. Games that require saving scores or rankings will be available again shortly.',
        }}
      />
      <p className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
        <Link
          href={localizeHref(locale, '/indice')}
          className="text-accent-primary underline underline-offset-4"
        >
          {locale === 'es' ? 'Ver el índice completo' : 'See the full index'}
        </Link>
      </p>
    </>
  );
}
