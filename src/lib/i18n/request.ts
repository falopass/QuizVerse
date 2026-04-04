import type { NextRequest } from 'next/server';
import { defaultLocale, hasLocale, locales, type Locale } from './dictionaries';
import { LOCALE_COOKIE } from './shared';

function pickFromAcceptLanguage(header: string | null): Locale {
  if (!header) {
    return defaultLocale;
  }

  return header.toLowerCase().includes('es') ? 'es' : defaultLocale;
}

export function getLocaleFromRequest(request: NextRequest): Locale {
  const pathnameLocale = request.nextUrl.pathname.split('/')[1];
  if (hasLocale(pathnameLocale)) {
    return pathnameLocale;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && hasLocale(cookieLocale)) {
    return cookieLocale;
  }

  return pickFromAcceptLanguage(request.headers.get('accept-language'));
}

export function pathnameHasLocale(pathname: string): boolean {
  return locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
}
