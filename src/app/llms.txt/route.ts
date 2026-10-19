import { NextResponse } from 'next/server';
import { getExplorePayload } from '@/lib/data/public';
import { localizeCategory } from '@/lib/i18n/catalog';
import { locales, type Locale } from '@/lib/i18n/dictionaries';
import {
  renderLlmsDocument,
  type LlmsHub,
  type LlmsLocaleSection,
  type LlmsQuizEntry,
} from '@/lib/seo/llms';
import type { Quiz } from '@/types/quiz';

export const revalidate = 3600;

/** Quiz types exposed as `/category/<slug>` hubs (same set as the sitemap). */
const TYPE_HUBS: Array<{ slug: string; name: Record<Locale, string> }> = [
  { slug: 'trivia', name: { en: 'Trivia', es: 'Trivia' } },
  { slug: 'personality', name: { en: 'Personality', es: 'Personalidad' } },
];

const SECTION_HEADINGS: Record<Locale, string> = { es: 'Español', en: 'English' };

async function buildSection(locale: Locale): Promise<LlmsLocaleSection> {
  const { quizzes, categories } = await getExplorePayload(locale);

  const countByCategory = new Map<string, number>();
  const countByType = new Map<string, number>();
  for (const quiz of quizzes) {
    if (quiz.category?.slug) {
      countByCategory.set(quiz.category.slug, (countByCategory.get(quiz.category.slug) ?? 0) + 1);
    }
    if (quiz.quiz_type) {
      countByType.set(quiz.quiz_type, (countByType.get(quiz.quiz_type) ?? 0) + 1);
    }
  }

  const hubs: LlmsHub[] = [
    ...categories.map((category) => ({
      name: localizeCategory(category, locale)?.name ?? category.name,
      slug: category.slug,
      count: countByCategory.get(category.slug) ?? 0,
    })),
    ...TYPE_HUBS.map((hub) => ({
      name: hub.name[locale],
      slug: hub.slug,
      count: countByType.get(hub.slug) ?? 0,
    })),
  ]
    .filter((hub) => hub.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const newest: LlmsQuizEntry[] = (quizzes as Quiz[])
    .slice()
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .map((quiz) => ({ title: quiz.title, slug: quiz.slug }));

  return { locale, heading: SECTION_HEADINGS[locale], hubs, newest };
}

function emptySection(locale: Locale): LlmsLocaleSection {
  return { locale, heading: SECTION_HEADINGS[locale], hubs: [], newest: [] };
}

export async function GET() {
  let sections: LlmsLocaleSection[];
  let ok = true;
  try {
    sections = await Promise.all(locales.map(buildSection));
    // Empty data means the catalog query failed silently (public layer
    // swallows DB errors): serve the minimal document instead of a stub.
    if (sections.every((section) => section.newest.length === 0)) ok = false;
  } catch {
    ok = false;
    sections = locales.map(emptySection);
  }
  if (!ok) sections = locales.map(emptySection);

  return new NextResponse(renderLlmsDocument(sections), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': ok
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
        : 'no-store',
    },
  });
}
