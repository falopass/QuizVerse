import { getStockCoverEntry } from '@/lib/data/stock-cover-manifest';
import { getQuizBySlug } from '@/lib/data/public';
import { buildQuizCoverSvg } from '@/lib/design/cover-svg';

export async function GET(
  _request: Request,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  const params = await context.params;
  const slug = typeof params.slug === 'string' ? params.slug : '';

  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const entry = getStockCoverEntry(slug);

  if (entry) {
    try {
      const response = await fetch(entry.image_url, {
        headers: {
          'User-Agent': 'QuizVerse/1.0',
        },
        next: { revalidate: 60 * 60 * 24 },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        return new Response(arrayBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      }
    } catch (error) {
      console.error('stock-cover-fetch-failed', { slug, error });
    }
  }

  const quiz = await getQuizBySlug(slug);

  if (!quiz) {
    return new Response('Not found', { status: 404 });
  }

  const svg = buildQuizCoverSvg(quiz);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

