/**
 * Number and date formatting helpers
 */
import type { Locale } from '@/lib/i18n/dictionaries';

const intlLocale = (locale: Locale) => (locale === 'es' ? 'es' : 'en-US');

export function formatNumber(num: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(num);
}

export function formatCompactNumber(num: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(num);
}

export function formatRelativeDate(date: Date | string, locale: Locale = 'en'): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (locale === 'es') {
    if (diffInSeconds < 60) return 'ahora mismo';
    if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }
  } else {
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  }

  return then.toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
