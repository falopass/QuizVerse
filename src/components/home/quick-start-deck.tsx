'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export type QuickStartKind = 'daily' | 'random' | 'personality' | 'trivia';

/** Una carta del mazo. Solo strings y booleanos: cruza del servidor al cliente. */
export interface QuickStartItem {
  kind: QuickStartKind;
  href: string;
  /** Rótulo grande de la carta («Quiz diario», «Quiz al azar»…). */
  title: string;
  /** Línea superior con un dato real (fecha del reto, tamaño del catálogo). */
  kicker: string;
  /** Texto del botón de la carta. */
  action: string;
  /** Los route handlers (/random) no se prefetchean: el 307 se sortea al clic. */
  prefetch: boolean;
}

interface QuickStartDeckProps {
  items: QuickStartItem[];
  heading: string;
  previousLabel: string;
  nextLabel: string;
}

/** Posición de scroll que deja la carta al inicio de la pista (respeta su padding). */
function slotOffset(track: HTMLElement, slot: HTMLElement): number {
  // La pista es position: relative, así que offsetLeft se mide contra ella.
  return slot.offsetLeft - (parseFloat(getComputedStyle(track).paddingLeft) || 0);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Mazo de accesos de la portada: cuatro cartas que son enlaces reales y se ven
 * completas antes de hidratar. Los botones y las flechas del teclado eligen la
 * carta activa (que se levanta del abanico) y, cuando el mazo es una pista
 * deslizable (móvil), la llevan al centro con scroll-snap.
 */
export function QuickStartDeck({ items, heading, previousLabel, nextLabel }: QuickStartDeckProps) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const scrollFrame = useRef(0);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const headingId = `qv-l9-deck-title-${uid}`;
  const trackId = `qv-l9-deck-track-${uid}`;
  const count = items.length;

  // Un golpe breve en la carta elegida: el mazo responde a cada pulsación.
  const bump = useCallback((index: number, direction: number) => {
    const card = cardRefs.current[index];
    if (!card || typeof card.animate !== 'function' || prefersReducedMotion()) return;
    card.animate(
      [
        { transform: `translate3d(${direction * 18}px, 6px, 0) rotate(${direction * 4}deg)` },
        { transform: 'translate3d(0, -18px, 0) rotate(0deg) scale(1.03)' },
        { transform: 'translate3d(0, -12px, 0) rotate(0deg)' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    );
  }, []);

  // En la pista deslizable la carta activa entra al viewport sin mover la página.
  const reveal = useCallback((index: number) => {
    const track = trackRef.current;
    const card = cardRefs.current[index]?.parentElement;
    if (!track || !card || track.scrollWidth <= track.clientWidth + 1) return;
    track.scrollTo({
      left: slotOffset(track, card),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  const select = useCallback(
    (index: number, direction: number, focus: boolean) => {
      const next = (index + count) % count;
      setActive(next);
      reveal(next);
      bump(next, direction);
      if (focus) cardRefs.current[next]?.focus({ preventScroll: true });
    },
    [bump, count, reveal]
  );

  // Al deslizar con el dedo, la carta más cercana al borde izquierdo pasa a ser
  // la activa: botones, lector y abanico cuentan la misma historia.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => {
        if (track.scrollWidth <= track.clientWidth + 1) return;
        const left = track.scrollLeft;
        let nearest = 0;
        let distance = Number.POSITIVE_INFINITY;
        cardRefs.current.forEach((card, index) => {
          const item = card?.parentElement;
          if (!item) return;
          const gap = Math.abs(slotOffset(track, item) - left);
          if (gap < distance) {
            distance = gap;
            nearest = index;
          }
        });
        setActive(nearest);
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = cardRefs.current.findIndex((card) => card === document.activeElement);
    // Con modificadores (Ctrl+Inicio, Alt+flecha…) manda el navegador.
    if (index === -1 || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      select(index + 1, 1, true);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(index - 1, -1, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0, -1, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(count - 1, 1, true);
    }
  };

  if (count === 0) return null;

  return (
    <section className="qv-l9-deck" aria-labelledby={headingId}>
      <div className="qv-l9-deck-head">
        <h2 id={headingId}>{heading}</h2>
        <div className="qv-l9-deck-controls">
          <button
            type="button"
            aria-label={previousLabel}
            aria-controls={trackId}
            onClick={() => select(active - 1, -1, false)}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            aria-controls={trackId}
            onClick={() => select(active + 1, 1, false)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <ul id={trackId} ref={trackRef} className="qv-l9-deck-track" onKeyDown={onKeyDown}>
        {items.map((item, index) => (
          <li key={item.kind} className="qv-l9-deck-slot">
            <Link
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              href={item.href}
              prefetch={item.prefetch ? undefined : false}
              className={cn('qv-l9-card', `qv-l9-card-${item.kind}`)}
              data-active={index === active ? 'true' : undefined}
              onFocus={() => setActive(index)}
            >
              <span className="qv-l9-card-kicker">{item.kicker}</span>
              <span className="qv-l9-card-title">{item.title}</span>
              <span className="qv-l9-card-action">
                {item.action} <span aria-hidden="true">↗</span>
              </span>
              <DeckGlyph kind={item.kind} />
            </Link>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {items[active]?.title}
      </p>
    </section>
  );
}

/** Glifo de la carta: decorativo, dibujado en SVG para no depender de fuentes. */
function DeckGlyph({ kind }: { kind: QuickStartKind }) {
  return (
    <svg className="qv-l9-card-glyph" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {kind === 'daily' ? (
        <>
          <rect x="14" y="22" width="72" height="64" rx="10" />
          <path d="M14 42h72M32 12v18M68 12v18" />
          <path d="M38 62l9 9 17-19" />
        </>
      ) : kind === 'random' ? (
        <>
          <rect x="16" y="16" width="68" height="68" rx="14" />
          <circle cx="34" cy="34" r="6" />
          <circle cx="66" cy="34" r="6" />
          <circle cx="50" cy="50" r="6" />
          <circle cx="34" cy="66" r="6" />
          <circle cx="66" cy="66" r="6" />
        </>
      ) : kind === 'personality' ? (
        <>
          <circle cx="50" cy="50" r="36" />
          <circle cx="37" cy="43" r="5" />
          <circle cx="63" cy="43" r="5" />
          <path d="M34 61q16 15 32 0" />
        </>
      ) : (
        <>
          <path d="M34 34q0-18 17-18t17 16q0 10-11 16t-7 16" />
          <circle cx="50" cy="80" r="5" />
        </>
      )}
    </svg>
  );
}
