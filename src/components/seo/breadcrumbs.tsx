import Link from 'next/link';
import type { Locale } from '@/lib/i18n/dictionaries';

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

/**
 * Visible breadcrumb trail. Kept in sync with the `BreadcrumbList` JSON-LD by
 * passing the same items to both — Google requires the markup to match what the
 * page actually shows.
 */
export function Breadcrumbs({
  items,
  locale,
  className = '',
}: {
  items: BreadcrumbItem[];
  locale: Locale;
  className?: string;
}) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label={locale === 'es' ? 'Ruta de navegación' : 'Breadcrumb'}
      className={`text-text-muted flex min-w-0 flex-nowrap items-center gap-x-2 overflow-hidden text-[11px] font-semibold ${className}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span
            key={`${item.name}-${index}`}
            className={`flex items-center gap-2 ${isLast ? 'min-w-0' : 'shrink-0'}`}
          >
            {index > 0 ? (
              <span aria-hidden="true" className="text-border-subtle">
                /
              </span>
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-accent-primary inline-flex min-h-11 min-w-11 items-center justify-center transition-colors"
              >
                {item.name}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={isLast ? 'text-accent-primary truncate' : undefined}
              >
                {item.name}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
