import { NextResponse } from 'next/server';

/**
 * Google Search Console — HTML file verification.
 *
 * Google only checks that `https://host/google<token>.html` exists and contains
 * `google-site-verification: google<token>.html`. This is handled in `proxy.ts`
 * (before the locale redirect) so a new property can be verified without
 * rebuilding the image or touching the codebase.
 *
 * Set GOOGLE_SITE_VERIFICATION as well to emit the equivalent meta tag.
 */

const FILE_PATTERN = /^\/google[a-zA-Z0-9]{6,}\.html$/;

const RESPONSE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'X-Robots-Tag': 'noindex',
};

/** Returns the verification document for `google<token>.html`, or `null` to fall through. */
export function googleVerificationResponse(pathname: string): NextResponse | null {
  if (!FILE_PATTERN.test(pathname)) return null;

  return new NextResponse(`google-site-verification: ${pathname.slice(1)}`, {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}
