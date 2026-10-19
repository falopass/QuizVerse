import { describe, it, expect } from 'vitest';
import { localizeHref, stripLocaleFromPathname, replacePathLocale } from '@/lib/i18n/navigation';

describe('localizeHref', () => {
  it.each([
    ['es', '/quiz', '/es/quiz'],
    ['en', '/quiz/space-trivia', '/en/quiz/space-trivia'],
    ['es', '/', '/es'],
    ['en', '/', '/en'],
  ])('(%s, %s) → %s', (locale, href, expected) => {
    expect(localizeHref(locale as 'es' | 'en', href)).toBe(expected);
  });

  it.each([
    ['en', '/en/quiz', '/en/quiz'],
    ['es', '/es', '/es'],
    ['es', '/es/quiz', '/es/quiz'],
    ['en', '/en', '/en'],
  ])('es idempotente: (%s, %s) → %s', (locale, href, expected) => {
    expect(localizeHref(locale as 'es' | 'en', href)).toBe(expected);
  });

  it.each(['/api/x', '/api', '/_next/static/x', '/favicon.ico', '/robots.txt', '/sitemap.xml'])(
    'deja pasar %s sin tocar',
    (href) => {
      expect(localizeHref('es', href)).toBe(href);
    }
  );

  it.each(['https://ejemplo.com', 'mailto:hola@ejemplo.com', '#seccion', ''])(
    'no toca hrefs que no empiezan con /: %s',
    (href) => {
      expect(localizeHref('es', href)).toBe(href);
    }
  );

  it('colapsa dobles slashes sin duplicar el prefijo', () => {
    expect(localizeHref('es', '//quiz')).toBe('/es/quiz');
    expect(localizeHref('es', '/es//quiz')).toBe('/es/quiz');
    expect(localizeHref('es', '/quiz//x')).toBe('/es/quiz/x');
  });

  it('no reconoce el prefijo del otro locale como ya localizado', () => {
    expect(localizeHref('es', '/en/quiz')).toBe('/es/en/quiz');
  });
});

describe('stripLocaleFromPathname', () => {
  it.each([
    ['/es', '/'],
    ['/en', '/'],
    ['/es/quiz/space-trivia', '/quiz/space-trivia'],
    ['/en/quiz/space-trivia', '/quiz/space-trivia'],
    ['/es/quiz/', '/quiz'],
    ['/quiz', '/quiz'],
    ['/settings/profile', '/settings/profile'],
    ['/', '/'],
    ['', '/'],
  ])('%s → %s', (pathname, expected) => {
    expect(stripLocaleFromPathname(pathname)).toBe(expected);
  });

  it('es idempotente', () => {
    expect(stripLocaleFromPathname(stripLocaleFromPathname('/es/quiz'))).toBe('/quiz');
  });
});

describe('replacePathLocale', () => {
  it.each([
    ['/es/quiz/x', 'en', '/en/quiz/x'],
    ['/en/quiz/x', 'es', '/es/quiz/x'],
    ['/es', 'en', '/en'],
    ['/', 'es', '/es'],
    ['/quiz', 'es', '/es/quiz'],
  ])('(%s, %s) → %s', (pathname, locale, expected) => {
    expect(replacePathLocale(pathname, locale as 'es' | 'en')).toBe(expected);
  });

  it('es idempotente al aplicarse dos veces con el mismo locale', () => {
    const once = replacePathLocale('/es/quiz/x', 'en');
    expect(replacePathLocale(once, 'en')).toBe('/en/quiz/x');
  });
});
