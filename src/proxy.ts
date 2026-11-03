import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { googleVerificationResponse } from '@/lib/seo/google-verification';
import { supabaseEnv } from '@/lib/supabase/env';
import { hasSessionCookie } from '@/lib/supabase/session-cookie';

function pathnameHasLocale(pathname: string) {
  return /^\/(en|es)(\/|$)/.test(pathname);
}

// Rutas que viven en la raíz (no llevan prefijo de idioma). Sin esta lista, el
// proxy las redirige a /<locale>/... y las portadas procedurales y las APIs
// terminan en 404. `/_next` se queda aunque el matcher ya filtre
// _next/static|_next/image: cualquier otra ruta bajo /_next debe resolver en el
// sitio (404 propio), no convertirse en un soft-404 tras redirect.
const NON_LOCALE_PREFIXES = [
  '/_next',
  '/api',
  '/covers',
  '/stock-covers',
  // El reproductor embebible lleva su propio /{locale} en la ruta (/embed/es/x).
  '/embed',
];

// `/callback` (route group `(auth)`) hace el intercambio PKCE de Supabase y no
// puede llevar prefijo de idioma. Es la única ruta exacta que llega al proxy:
// las rutas con extensión de antes (favicon.ico, robots.txt, sitemap.xml,
// manifest.json, *.png, sw.js si volviera) ya las filtra el `matcher`.
const NON_LOCALE_EXACT = ['/callback'];

/**
 * Esquema con el que el cliente llegó al edge. `cf-visitor` (Cloudflare) manda
 * cuando existe; `x-forwarded-proto` es el respaldo genérico. En local no hay
 * ninguna de las dos, así que no redirige ni rompe el dev server.
 */
function cameOverHttp(request: NextRequest) {
  const cfVisitor = request.headers.get('cf-visitor');
  if (cfVisitor) {
    try {
      const scheme = (JSON.parse(cfVisitor) as { scheme?: string }).scheme;
      if (scheme) return scheme === 'http';
    } catch {
      // cf-visitor malformado: se decide con x-forwarded-proto.
    }
  }
  const proto = request.headers.get('x-forwarded-proto');
  return proto !== null && proto.split(',')[0].trim().toLowerCase() === 'http';
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return hasSessionCookie(request.cookies.getAll());
}

/**
 * Idioma preferido entre los tags de Accept-Language: gana el `q` más alto
 * (`q=0` significa "no aceptado" y se descarta), comparando solo el subtag
 * primario: `es-CL` → es, `ca-ES` no matchea (antes `includes('es')` lo
 * atrapaba). Empate: gana el que aparece primero.
 */
function getLocaleFromRequest(request: NextRequest) {
  const accept = request.headers.get('accept-language') || '';
  let best: { locale: 'en' | 'es'; q: number } | null = null;
  for (const tag of accept.split(',')) {
    const [lang, ...params] = tag.trim().split(';');
    const primary = lang.trim().toLowerCase().split('-')[0];
    if (primary !== 'es' && primary !== 'en') continue;
    const qParam = params
      .map((param) => param.trim().toLowerCase())
      .find((p) => p.startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) continue;
    if (!best || q > best.q) best = { locale: primary, q };
  }
  return best?.locale ?? 'en';
}

// Archivos de metadata de Next (ImageResponse): fijan su propio Cache-Control
// público y no son HTML; no se tocan.
const METADATA_FILE_RE = /\/(opengraph-image|twitter-image|icon|apple-icon)$/;

/**
 * Solo documentos/RSC: los handlers y las acciones conservan sus políticas.
 */
function isPageRequest(request: NextRequest, pathname: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (!pathnameHasLocale(pathname)) return false;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !lastSegment.includes('.') && !METADATA_FILE_RE.test(pathname);
}

// Lista cerrada de páginas sin personalización de servidor. Next decide si la
// respuesta es ISR, redirect, 404 o error; nunca forzamos `public` desde aquí.
const CACHEABLE_PAGE_RE =
  /^\/(en|es)(?:\/(?:quiz(?:\/[^/.]+)?|about|faq|privacy|terms|contact))?\/?$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // HTTP → HTTPS antes que nada: cualquier respuesta servida por http (redirects
  // incluidos) sería un salto extra y contenido inseguro. Cloudflare sobrescribe
  // cf-visitor y x-forwarded-proto, pero si la URL ya es https no se redirige:
  // un 308 a la misma URL sería un bucle.
  if (cameOverHttp(request)) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    if (httpsUrl.href !== request.nextUrl.href) {
      return NextResponse.redirect(httpsUrl, 308);
    }
  }

  // Search Console verification lives at the root and must answer before any
  // locale redirect or auth round-trip.
  const verification = googleVerificationResponse(pathname);
  if (verification) return verification;

  // Solo los errores sin params necesitan este fallback; los layouts usan la ruta.
  request.headers.set(
    'x-quizverse-locale',
    pathname.startsWith('/es') || pathname.startsWith('/embed/es') ? 'es' : 'en'
  );
  let response = NextResponse.next({ request });

  // El refresh de sesión solo tiene sentido cuando viene la cookie de auth: sin
  // ella getUser() igualmente viajaba a Supabase en cada request y devolvía
  // null. Con cookie el comportamiento es exactamente el de antes.
  const hasSession = hasSupabaseSessionCookie(request);
  if (hasSession) {
    const { url, anonKey } = supabaseEnv();
    const supabase = createServerClient<Database>(url, anonKey, {
      // Igual que src/lib/supabase/server.ts: Secure en producción. httpOnly
      // queda en false porque el browser client lee la sesión por JS.
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
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
  }

  if (
    pathnameHasLocale(pathname) ||
    NON_LOCALE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    NON_LOCALE_EXACT.includes(pathname)
  ) {
    if (isPageRequest(request, pathname)) {
      // No escribir Vary aquí: OpenNext da prioridad al proxy y sustituiría
      // los selectores RSC que añade Next (no los combina).
      if (hasSession || !CACHEABLE_PAGE_RE.test(pathname)) {
        response.headers.set('Cache-Control', 'private, no-cache');
      }
    }
    return response;
  }

  const locale = getLocaleFromRequest(request);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  // `/` se queda en 307: su destino cambia con Accept-Language y un 308
  // cacheado atraparía a quien cambie de idioma del navegador. El resto de
  // rutas sin locale son moved-permanently (308): nunca servirán contenido y el
  // SEO debe consolidarse en la URL localizada.
  const redirect = NextResponse.redirect(redirectUrl, pathname === '/' ? 307 : 308);
  redirect.headers.set('Vary', 'Accept-Language');
  return redirect;
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
