import { NextResponse } from 'next/server';

/**
 * Google Search Console — HTML file verification.
 *
 * Reached through a rewrite: `/google<token>.html` → this handler. Google only
 * checks that the file exists and contains `google-site-verification: <file>`,
 * so any well-formed filename works without touching the codebase or rebuilding
 * the image when a new property is created.
 *
 * Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION as well to also emit the meta tag.
 */

const FILE_PATTERN = /^google[a-zA-Z0-9]{6,}\.html$/;

export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get('file') ?? '';

  if (!FILE_PATTERN.test(file)) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(`google-site-verification: ${file}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
