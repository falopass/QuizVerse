import type { Locale } from './dictionaries';
import { defaultLocale, hasLocale } from './dictionaries';

export function localizeHref(locale: Locale, href: string): string {
  if (!href.startsWith('/')) {
    return href;
  }

  if (
    href.startsWith('/api') ||
    href.startsWith('/_next') ||
    href === '/favicon.ico' ||
    href === '/robots.txt' ||
    href === '/sitemap.xml'
  ) {
    return href;
  }

  if (href === '/') {
    return `/${locale}`;
  }

  return (
    href.startsWith(`/${locale}/`) || href === `/${locale}` ? href : `/${locale}${href}`
  ).replace(/\/{2,}/g, '/');
}

export function stripLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];

  if (hasLocale(maybeLocale)) {
    const next = `/${segments.slice(2).join('/')}`.replace(/\/{2,}/g, '/');
    return next === '/' ? '/' : next.replace(/\/$/, '') || '/';
  }

  return pathname || '/';
}

export function replacePathLocale(pathname: string, locale: Locale): string {
  return localizeHref(locale, stripLocaleFromPathname(pathname));
}

/**
 * Idioma de una ruta, para componentes cliente que no reciben el locale por
 * props (toasts, banner de cookies, boundaries de error, modal).
 * `/embed/{locale}/…` no cuelga de `/[locale]`: ahí el idioma es el segundo
 * segmento. Sin prefijo reconocible se cae al idioma por defecto.
 */
export function localeFromPathname(pathname: string | null | undefined): Locale {
  const path = pathname || '/';
  const segments = stripLocaleFromPathname(path).split('/');
  const segment = segments[1] === 'embed' ? segments[2] : path.split('/')[1];

  return hasLocale(segment) ? segment : defaultLocale;
}
