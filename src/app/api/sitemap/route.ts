import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSitemapXml } from '@/lib/seo/sitemap';
import type { SitemapEntry } from '@/lib/seo/sitemap';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org';

async function fetchPublishedQuizzes(): Promise<Array<{ slug: string; published_at: string | null; language: string }>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('quizzes')
      .select('slug, published_at, language')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5000);

    return (data as Array<{ slug: string; published_at: string | null; language: string }>) ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  const quizzes = await fetchPublishedQuizzes();

  const staticPages: SitemapEntry[] = [
    { url: '/en', changeFrequency: 'daily', priority: 1.0 },
    { url: '/es', changeFrequency: 'daily', priority: 1.0 },
    { url: '/en/quiz', changeFrequency: 'daily', priority: 0.9 },
    { url: '/es/quiz', changeFrequency: 'daily', priority: 0.9 },
    { url: '/en/leaderboard', changeFrequency: 'hourly', priority: 0.8 },
    { url: '/es/leaderboard', changeFrequency: 'hourly', priority: 0.8 },
    { url: '/en/create', changeFrequency: 'weekly', priority: 0.7 },
    { url: '/es/create', changeFrequency: 'weekly', priority: 0.7 },
    { url: '/en/about', changeFrequency: 'monthly', priority: 0.5 },
    { url: '/es/about', changeFrequency: 'monthly', priority: 0.5 },
    { url: '/en/terms', changeFrequency: 'monthly', priority: 0.3 },
    { url: '/es/terms', changeFrequency: 'monthly', priority: 0.3 },
    { url: '/en/privacy', changeFrequency: 'monthly', priority: 0.3 },
    { url: '/es/privacy', changeFrequency: 'monthly', priority: 0.3 },
  ];

  const quizEntries: SitemapEntry[] = quizzes.map((quiz) => ({
    url: `/${quiz.language}/quiz/${quiz.slug}`,
    lastModified: quiz.published_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const xml = generateSitemapXml([...staticPages, ...quizEntries], siteUrl);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=14400',
    },
  });
}
