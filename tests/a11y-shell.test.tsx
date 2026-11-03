/**
 * A11Y-06/11/12/13/14: shell accesible.
 * - Un solo <main id="main-content"> por página (guard de fuente).
 * - RouteAnnouncer anuncia el h1 de la página nueva y mueve el foco a <main>,
 *   excepto en back/forward (popstate), donde manda la restauración de scroll.
 * - Los estados vacíos (EditorialEmptyState) usan h1.
 * - Los landmarks de navegación tienen etiquetas únicas.
 * - Los botones de compartir cumplen contraste WCAG AA (>= 4.5:1).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Category } from '@/types/quiz';

const mocks = vi.hoisted(() => ({
  pathname: '/en',
  search: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock('@/actions/quiz.actions', () => ({
  incrementShares: vi.fn(async () => ({ success: true })),
}));

import { NotFoundContent } from '@/components/layout/not-found-content';
import { EditorialEmptyState } from '@/components/home/app-placeholders';
import { CategoryStrip } from '@/components/home/category-strip';
import { Footer } from '@/components/layout/footer';
import { ShareButtons } from '@/components/shared/share-buttons';
import { getDictionary } from '@/lib/i18n/dictionaries';

const SRC = join(__dirname, '..', 'src');

function* tsxFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* tsxFiles(path);
    else if (entry.endsWith('.tsx')) yield path;
  }
}

// Rutas fuera de SiteShell que sí pueden renderizar su propio <main>.
const ALLOWED_MAIN = new Set([
  'components/layout/site-shell.tsx',
  'app/global-not-found.tsx',
  'app/embed/[locale]/[slug]/page.tsx',
  'app/embed/[locale]/not-found.tsx',
]);
const ALLOWED_MAIN_ID = new Set(['components/layout/site-shell.tsx', 'app/global-not-found.tsx']);

// Los comentarios pueden citar `<main>` como texto; se quitan antes de buscar.
function codeOnly(file: string) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

describe('A11Y-12: un solo <main id="main-content"> por página', () => {
  it('ningún archivo fuera del shell y los embeds renderiza <main>', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const rel = relative(SRC, file);
      if (/<main[\s>]/.test(codeOnly(file)) && !ALLOWED_MAIN.has(rel)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('id="main-content" solo existe en el shell y el 404 raíz', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const rel = relative(SRC, file);
      if (/id="main-content"/.test(codeOnly(file)) && !ALLOWED_MAIN_ID.has(rel)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('A11Y-13: estados vacíos con h1', () => {
  it('EditorialEmptyState pinta el título como h1', () => {
    render(<EditorialEmptyState title="Nada por aquí" body="Vuelve luego." />);

    expect(screen.getByRole('heading', { level: 1, name: 'Nada por aquí' })).toBeInTheDocument();
  });

  it('el 404 tiene exactamente un h1', () => {
    render(<NotFoundContent locale="en" />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('That page drifted out of orbit.');
  });
});

describe('A11Y-14: landmarks de navegación con etiquetas únicas', () => {
  const categories: Category[] = [
    {
      id: 'c1',
      slug: 'music',
      name: 'Music',
      description: null,
      icon: null,
      color: null,
      gradient_from: null,
      gradient_to: null,
      quiz_count: 10,
      sort_order: 1,
    },
    {
      id: 'c2',
      slug: 'gaming',
      name: 'Gaming',
      description: null,
      icon: null,
      color: null,
      gradient_from: null,
      gradient_to: null,
      quiz_count: 8,
      sort_order: 2,
    },
  ];

  it('la tira de categorías de la home y el footer no comparten nombre', async () => {
    const dictionary = await getDictionary('en');
    render(
      <>
        {await CategoryStrip({ categories, locale: 'en' })}
        <Footer dictionary={dictionary} locale="en" categorySlugs={['music', 'gaming']} />
      </>
    );

    const names = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'));
    expect(names).toContain('Category shortcuts');
    expect(names).toContain('Categories');
    expect(new Set(names).size).toBe(names.length);
  });

  it('el nav de categorías de /category/[slug] no repite la etiqueta del footer', () => {
    const source = codeOnly(join(SRC, 'app/[locale]/category/[slug]/page.tsx'));
    const nav = source.match(/<nav className="arcade-filters" aria-label=\{([^}]+)\}/);
    expect(nav).not.toBeNull();
    expect(nav![1]).not.toContain('allCategories');
  });
});

describe('A11Y-06: anuncio de navegación y foco al contenido', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // El flag "primera montada" vive en el módulo: reset para aislar tests.
    vi.resetModules();
    mocks.pathname = '/en';
    mocks.search = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderPage(title: string) {
    const { RouteAnnouncer } = await import('@/components/layout/route-announcer');
    return render(
      <>
        <RouteAnnouncer />
        <main id="main-content" tabIndex={-1}>
          <h1>{title}</h1>
        </main>
      </>
    );
  }

  it('no anuncia ni mueve el foco en la carga inicial', async () => {
    await renderPage('Home');

    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    expect(document.activeElement?.id).not.toBe('main-content');
  });

  it('tras navegar anuncia el h1 nuevo y enfoca <main>', async () => {
    const { RouteAnnouncer } = await import('@/components/layout/route-announcer');
    const { rerender } = await renderPage('Home');

    mocks.pathname = '/en/quiz';
    rerender(
      <>
        <RouteAnnouncer />
        <main id="main-content" tabIndex={-1}>
          <h1>Explore quizzes</h1>
        </main>
      </>
    );
    act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole('status')).toHaveTextContent('Explore quizzes');
    expect(document.activeElement?.id).toBe('main-content');
  });

  it('anuncia también cuando solo cambia la query (paginación, pestañas)', async () => {
    const { rerender } = await renderPage('Geography');

    mocks.search = 'page=2';
    const { RouteAnnouncer } = await import('@/components/layout/route-announcer');
    rerender(
      <>
        <RouteAnnouncer />
        <main id="main-content" tabIndex={-1}>
          <h1>Geography</h1>
        </main>
      </>
    );
    act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole('status')).toHaveTextContent('Geography');
    expect(document.activeElement?.id).toBe('main-content');
  });

  it('al remontarse (cambio de idioma) sí anuncia la página nueva', async () => {
    const { unmount } = await renderPage('Home');
    unmount();

    await renderPage('Inicio');
    act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole('status')).toHaveTextContent('Inicio');
    expect(document.activeElement?.id).toBe('main-content');
  });

  it('Atrás entre idiomas (popstate + remontaje) no roba el foco', async () => {
    // El popstate lo recibe la instancia montada; el shell se remonta después.
    const { unmount } = await renderPage('Inicio');
    act(() => {
      window.dispatchEvent(new Event('popstate'));
    });
    unmount();

    await renderPage('Home');
    act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole('status')).toHaveTextContent('Home');
    expect(document.activeElement?.id).not.toBe('main-content');
  });

  it('en back/forward (popstate) no roba el foco', async () => {
    const { RouteAnnouncer } = await import('@/components/layout/route-announcer');
    const { rerender } = await renderPage('Home');

    mocks.pathname = '/en/quiz';
    rerender(
      <>
        <RouteAnnouncer />
        <main id="main-content" tabIndex={-1}>
          <h1>Explore quizzes</h1>
        </main>
      </>
    );
    act(() => vi.advanceTimersByTime(200));
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement?.id).not.toBe('main-content');

    mocks.pathname = '/en';
    act(() => {
      window.dispatchEvent(new Event('popstate'));
    });
    rerender(
      <>
        <RouteAnnouncer />
        <main id="main-content" tabIndex={-1}>
          <h1>Home</h1>
        </main>
      </>
    );
    act(() => vi.advanceTimersByTime(200));

    expect(screen.getByRole('status')).toHaveTextContent('Home');
    expect(document.activeElement?.id).not.toBe('main-content');
  });
});

describe('A11Y-11: contraste de los botones de compartir', () => {
  function channel(value: number) {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function luminance(hex: string) {
    const n = parseInt(hex.slice(1), 16);
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  }
  function contrast(a: string, b: string) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }
  function bgHex(element: Element) {
    const match = element.className.match(/bg-\[(#[0-9A-Fa-f]{6})\]/);
    expect(match).not.toBeNull();
    return match![1];
  }

  it('WhatsApp y Facebook llegan a >= 4.5:1 con texto blanco', () => {
    const { container } = render(<ShareButtons title="t" url="https://x.test" text="t" />);

    const whatsapp = container.querySelector('a[href^="https://wa.me"]')!;
    const facebook = container.querySelector('a[href*="facebook.com/sharer"]')!;
    for (const link of [whatsapp, facebook]) {
      expect(link.className).toContain('text-white');
      expect(contrast('#ffffff', bgHex(link))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
