/**
 * Mazo de accesos de la portada (L9): cuatro enlaces reales visibles sin JS,
 * controles visibles con nombre, teclado con flechas/Inicio/Fin, scroll de la
 * pista solo cuando desborda y respeto de prefers-reduced-motion.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickStartDeck, type QuickStartItem } from '@/components/home/quick-start-deck';

const ITEMS: QuickStartItem[] = [
  {
    kind: 'daily',
    href: '/es/daily',
    title: 'Quiz diario',
    kicker: 'Reto #19 · domingo, 23 de noviembre',
    action: 'Jugar',
    prefetch: true,
  },
  {
    kind: 'random',
    href: '/es/random',
    title: 'Quiz al azar',
    kicker: '717 quizzes',
    action: 'Jugar',
    prefetch: false,
  },
  {
    kind: 'personality',
    href: '/es/category/personality',
    title: 'Personalidad',
    kicker: '197 quizzes',
    action: 'Explorar',
    prefetch: true,
  },
  {
    kind: 'trivia',
    href: '/es/category/trivia',
    title: 'Trivia',
    kicker: '520 quizzes',
    action: 'Explorar',
    prefetch: true,
  },
];

function renderDeck() {
  return render(
    <QuickStartDeck
      items={ITEMS}
      heading="Empezar a jugar"
      previousLabel="Acceso anterior"
      nextLabel="Acceso siguiente"
    />
  );
}

function activeCard(container: HTMLElement) {
  return container.querySelector('a.qv-l9-card[data-active="true"]');
}

const scrollTo = vi.fn();
let reducedMotion = false;

beforeEach(() => {
  scrollTo.mockReset();
  reducedMotion = false;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduce') ? reducedMotion : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuickStartDeck', () => {
  it('sin hidratar ya pinta los cuatro enlaces reales con su texto', () => {
    const html = renderToStaticMarkup(
      <QuickStartDeck
        items={ITEMS}
        heading="Empezar a jugar"
        previousLabel="Acceso anterior"
        nextLabel="Acceso siguiente"
      />
    );
    for (const item of ITEMS) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.title);
    }
  });

  it('es una región con título, lista de cuatro enlaces y botones con nombre', () => {
    renderDeck();

    expect(screen.getByRole('region', { name: 'Empezar a jugar' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(ITEMS.map((i) => i.href));
    expect(screen.getByRole('link', { name: /Quiz al azar/ })).toHaveAttribute(
      'href',
      '/es/random'
    );
    const previous = screen.getByRole('button', { name: 'Acceso anterior' });
    const next = screen.getByRole('button', { name: 'Acceso siguiente' });
    const track = document.querySelector('ul.qv-l9-deck-track');
    expect(previous).toHaveAttribute('aria-controls', track?.id);
    expect(next).toHaveAttribute('aria-controls', track?.id);
  });

  it('los botones pasan la carta activa en ciclo y lo anuncian', () => {
    const { container } = renderDeck();
    const next = screen.getByRole('button', { name: 'Acceso siguiente' });
    const previous = screen.getByRole('button', { name: 'Acceso anterior' });

    expect(activeCard(container)).toHaveAttribute('href', '/es/daily');
    fireEvent.click(next);
    expect(activeCard(container)).toHaveAttribute('href', '/es/random');
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Quiz al azar');

    fireEvent.click(previous);
    fireEvent.click(previous);
    expect(activeCard(container)).toHaveAttribute('href', '/es/category/trivia');
  });

  it('con teclado: flechas, Inicio y Fin mueven el foco entre cartas', () => {
    renderDeck();
    const links = screen.getAllByRole('link');

    links[0].focus();
    fireEvent.keyDown(links[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(links[1]);
    fireEvent.keyDown(links[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(links[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(links[3]);
    fireEvent.keyDown(links[3], { key: 'Home' });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(links[0], { key: 'End' });
    expect(document.activeElement).toBe(links[3]);
  });

  it('con Ctrl, Alt o Meta deja la tecla al navegador', () => {
    renderDeck();
    const links = screen.getAllByRole('link');

    links[1].focus();
    fireEvent.keyDown(links[1], { key: 'Home', ctrlKey: true });
    fireEvent.keyDown(links[1], { key: 'End', metaKey: true });
    fireEvent.keyDown(links[1], { key: 'ArrowRight', altKey: true });
    expect(document.activeElement).toBe(links[1]);
  });

  it('solo desplaza la pista cuando desborda (móvil) y sin suavizado con reduce', () => {
    const { container } = renderDeck();
    const track = container.querySelector<HTMLUListElement>('ul.qv-l9-deck-track')!;
    const next = screen.getByRole('button', { name: 'Acceso siguiente' });

    // Escritorio: la pista no desborda, no hay scroll.
    fireEvent.click(next);
    expect(scrollTo).not.toHaveBeenCalled();

    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1200 });
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 390 });
    fireEvent.click(next);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    reducedMotion = true;
    fireEvent.click(next);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('con prefers-reduced-motion no anima la carta al pasarla', () => {
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate;
    renderDeck();
    const next = screen.getByRole('button', { name: 'Acceso siguiente' });

    fireEvent.click(next);
    expect(animate).toHaveBeenCalledTimes(1);

    reducedMotion = true;
    fireEvent.click(next);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('sin cartas no pinta nada', () => {
    const { container } = render(
      <QuickStartDeck items={[]} heading="x" previousLabel="a" nextLabel="b" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
