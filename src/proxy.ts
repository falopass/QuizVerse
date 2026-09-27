import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

function pathnameHasLocale(pathname: string) {
  return /^\/(en|es)(\/|$)/.test(pathname);
}

// Rutas que viven en la raíz (no llevan prefijo de idioma). Sin esta lista, el
// proxy las redirige a /<locale>/... y las portadas procedurales y el manifest
// del PWA terminan en 404.
const NON_LOCALE_PREFIXES = ['/_next', '/api', '/covers', '/stock-covers', '/icons', '/images'];

const NON_LOCALE_EXACT = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
