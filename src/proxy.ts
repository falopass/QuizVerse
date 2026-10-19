import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { googleVerificationResponse } from '@/lib/seo/google-verification';
import { supabaseEnv } from '@/lib/supabase/env';

function pathnameHasLocale(pathname: string) {
  return /^\/(en|es)(\/|$)/.test(pathname);
}

// Rutas que viven en la raíz (no llevan prefijo de idioma). Sin esta lista, el
// proxy las redirige a /<locale>/... y las portadas procedurales y el manifest
// del PWA terminan en 404.
const NON_LOCALE_PREFIXES = [
  '/_next',
  '/api',
  '/covers',
  '/stock-covers',
  '/icons',
  '/images',
  '/ronda-diseno',
];

const NON_LOCALE_EXACT = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/callback',
  '/manifest.json',
  '/sw.js',
  '/opengraph-image',
  '/icon.png',
  '/apple-icon.png',
];
function getLocaleFromRequest(request: NextRequest) {
  const accept = request.headers.get('accept-language') || '';
  if (accept.includes('es')) return 'es';
  return 'en';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Search Console verification lives at the root and must answer before any
  // locale redirect or auth round-trip.
  const verification = googleVerificationResponse(pathname);
  if (verification) return verification;

  const { url, anonKey } = supabaseEnv();

  request.headers.set('x-quizverse-locale', pathname.startsWith('/es') ? 'es' : 'en');
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  if (
    pathnameHasLocale(pathname) ||
    NON_LOCALE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    NON_LOCALE_EXACT.includes(pathname)
  ) {
    return response;
  }

  const locale = getLocaleFromRequest(request);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  // Static files and search-engine control files live at the root and must never
  // be redirected into a locale prefix: an IndexNow key file (/{key}.txt) or the
  // Google verification file (google<token>.html) returning a 307 fails the check.
  // `.html` is intentionally NOT excluded: the verification handler above answers it.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest)$).*)',
  ],
};
