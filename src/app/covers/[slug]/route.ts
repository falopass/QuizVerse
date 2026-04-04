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

