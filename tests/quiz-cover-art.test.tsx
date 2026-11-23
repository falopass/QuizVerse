import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import {
  QuizCoverArt,
  STOCK_COVER_WIDTHS,
  stockCoverVariant,
} from '@/components/shared/quiz-cover-art';
import { CARD_COPY, EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { RecentlyPlayed } from '@/components/home/recently-played';
import { STORAGE_KEY } from '@/lib/history/recent-quizzes';
import { getArcadeCopy, getCommonCopy } from '@/lib/i18n/dictionaries';

const quizConFoto = {
  slug: 'test-quiz',
  title: 'Test Quiz',
  quiz_type: 'trivia' as const,
  category: null,
  cover_image_url: '/stock-covers/test-quiz',
};

describe('QuizCoverArt · foto', () => {
  it('héroe (decorative + priorityLabel): eager y fetchpriority=high', () => {
    const { container } = render(
      <QuizCoverArt quiz={quizConFoto} locale="es" decorative priorityLabel="Novedades / 001" />
    );
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('declara width/height de la variante 3:2 que sirve la ruta', () => {
    const { container } = render(<QuizCoverArt quiz={quizConFoto} locale="es" decorative />);
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).toHaveAttribute('width', '960');
    expect(img).toHaveAttribute('height', '640');
  });

  it('tarjeta (decorative sin priorityLabel): lazy y sin fetchpriority', () => {
    const { container } = render(<QuizCoverArt quiz={quizConFoto} locale="es" decorative />);
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).not.toHaveAttribute('fetchpriority');
  });

  it('detalle (decorative + priorityLabel=""): eager y fetchpriority=high', () => {
    const { container } = render(
      <QuizCoverArt quiz={quizConFoto} locale="es" decorative priorityLabel="" />
    );
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('quiz sin foto no renderiza ningún <img>', () => {
    const { container } = render(
      <QuizCoverArt quiz={{ ...quizConFoto, cover_image_url: null }} locale="es" decorative />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('portada procedural (/covers/...) no renderiza <img>', () => {
    const { container } = render(
      <QuizCoverArt
        quiz={{ ...quizConFoto, cover_image_url: '/covers/test-quiz.svg' }}
        locale="es"
        decorative
      />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('showTitle={false} no imprime el título sobre la portada', () => {
    const { container } = render(<QuizCoverArt quiz={quizConFoto} locale="es" showTitle={false} />);
    expect(container.querySelector('.arcade-cover-title')).toBeNull();
  });

  it('sin la prop sigue imprimiendo el título (ficha y hero no cambian)', () => {
    const { container } = render(<QuizCoverArt quiz={quizConFoto} locale="es" />);
    expect(container.querySelector('.arcade-cover-title')).not.toBeNull();
  });

  // La otra mitad del contrato (la ruta responde image/svg+xml cuando el
  // proveedor cae) la cubre cover-routes.test.ts; el <img> directo es lo que
  // hace que ese SVG se pinte — jsdom no descarga ni renderiza imágenes.
  it('sirve la foto directo desde /stock-covers/, así el SVG de fallback también se pinta', () => {
    const { container } = render(<QuizCoverArt quiz={quizConFoto} locale="es" decorative />);
    const img = container.querySelector('img.arcade-cover-photo');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/stock-covers/test-quiz');
    expect(container.innerHTML).not.toContain('/_next/image');
    expect(container.innerHTML).not.toContain('images.pexels.com');
  });
});

describe('QuizCoverArt · variantes stock (L8)', () => {
  it('srcset con las tres variantes acotadas y la versión ?v= intacta', () => {
    const { container } = render(
      <QuizCoverArt
        quiz={{ ...quizConFoto, cover_image_url: '/stock-covers/test-quiz?v=abc123' }}
        locale="es"
        decorative
        compact
      />
    );
    const img = container.querySelector('img.arcade-cover-photo')!;
    expect(img.getAttribute('src')).toBe('/stock-covers/test-quiz?v=abc123');
    expect(img.getAttribute('srcset')).toBe(
      STOCK_COVER_WIDTHS.map((w) => `/stock-covers/test-quiz?v=abc123&w=${w} ${w}w`).join(', ')
    );
    // Tarjeta: la fila móvil pide 96 px, no la variante de 960.
    expect(img.getAttribute('sizes')).toContain('96px');
  });

  it('registro antiguo sin ?v= también recibe variantes (?w=)', () => {
    expect(stockCoverVariant('/stock-covers/viejo', 320)).toBe('/stock-covers/viejo?w=320');
  });

  it('ficha y hero usan sizes de ancho grande', () => {
    const { container } = render(
      <QuizCoverArt quiz={quizConFoto} locale="es" decorative priorityLabel="" />
    );
    expect(container.querySelector('img')!.getAttribute('sizes')).toContain('100vw');
  });
});

describe('QuizCoverArt · arte propio (L8)', () => {
  const base = {
    slug: 'es-trivia-de-videojuegos',
    title: '¿Cuánto sabes de videojuegos?',
    quiz_type: 'trivia' as const,
    category: { name: 'Videojuegos', slug: 'gaming' },
  };

  it.each([null, '/covers/es-trivia-de-videojuegos', '/covers/es-trivia-de-videojuegos.svg'])(
    'portada %j: pinta el arte en línea, nunca una caja vacía',
    (cover) => {
      const { container } = render(
        <QuizCoverArt
          quiz={{ ...base, cover_image_url: cover }}
          locale="es"
          decorative
          showTitle={false}
        />
      );
      const root = container.querySelector('.qv8-cover')!;
      expect(root.getAttribute('data-motif')).toBe('pixels');
      expect(container.querySelector('svg.qv8-art')!.innerHTML.length).toBeGreaterThan(50);
      // Inicial de la primera palabra con peso («¿Cuánto sabes de…» → V).
      expect(container.querySelector('.qv8-glyph')!.textContent).toBe('V');
      expect(container.querySelector('img')).toBeNull();
    }
  );

  it('con foto, el arte queda debajo como respaldo si la imagen no carga', () => {
    const { container } = render(
      <QuizCoverArt
        quiz={{ ...base, cover_image_url: '/stock-covers/es-trivia-de-videojuegos?v=1' }}
        locale="es"
        decorative
        showTitle={false}
      />
    );
    const root = container.querySelector('.qv8-cover')!;
    expect(root).toHaveClass('qv8-cover-has-photo');
    const classes = Array.from(root.children).map((el) => el.getAttribute('class'));
    expect(classes.indexOf('qv8-art')).toBeGreaterThanOrEqual(0);
    expect(classes.indexOf('qv8-art')).toBeLessThan(classes.indexOf('arcade-cover-photo'));
  });

  it('es determinista: mismo slug, mismo arte; otro slug, otra variación', () => {
    const artOf = (slug: string) =>
      render(
        <QuizCoverArt quiz={{ ...base, slug, cover_image_url: null }} locale="es" decorative />
      ).container.querySelector('svg.qv8-art')!.innerHTML;
    expect(artOf(base.slug)).toBe(artOf(base.slug));
    expect(artOf(base.slug)).not.toBe(artOf('en-video-game-trivia'));
  });

  it('el arte no lleva texto del usuario (solo formas)', () => {
    const { container } = render(
      <QuizCoverArt
        quiz={{ ...base, title: '<b>Hola</b> & adiós', cover_image_url: null }}
        locale="es"
        decorative
      />
    );
    const art = container.querySelector('svg.qv8-art')!;
    expect(art.querySelector('text')).toBeNull();
    expect(art.innerHTML).not.toContain('Hola');
  });

  it('con título impreso (hero) el campo es pleno para que la tinta lea', () => {
    const { container } = render(
      <QuizCoverArt
        quiz={{ ...base, cover_image_url: null }}
        locale="es"
        decorative
        priorityLabel="Destacado"
      />
    );
    expect(container.querySelector('.qv8-cover')).toHaveClass('qv8-cover-pleno');
    expect(container.querySelector('.qv8-glyph')).toBeNull();
  });

  it('decorativa: todo el arte queda fuera del árbol accesible', () => {
    const { container } = render(
      <QuizCoverArt
        quiz={{ ...base, cover_image_url: null }}
        locale="es"
        decorative
        showTitle={false}
      />
    );
    expect(container.querySelector('.qv8-cover')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('EditorialQuizCard · copy local (D-04)', () => {
  it('CARD_COPY es espejo exacto del diccionario', () => {
    for (const locale of ['es', 'en'] as const) {
      expect(CARD_COPY[locale].play).toBe(getArcadeCopy(locale).play);
      expect(CARD_COPY[locale].minutesShort).toBe(getCommonCopy(locale).minutesShort);
    }
  });

  it('sin slug de categoría, el acento cae al tipo de juego', () => {
    const { container } = render(
      <EditorialQuizCard
        quiz={{
          slug: 'es-quien-eres',
          title: '¿Quién eres?',
          quiz_type: 'personality',
          estimated_minutes: 4,
          cover_image_url: null,
          category: { name: 'Anime' },
        }}
        locale="es"
      />
    );
    const card = container.querySelector('a.arcade-card') as HTMLElement;
    expect(card.style.getPropertyValue('--qv-accent')).toBe('#ff7ad9');
  });
});

describe('RecentlyPlayed · misma tarjeta que el catálogo', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('lee un registro antiguo (sin score, stock sin ?v=) y enlaza al locale donde se jugó', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          slug: 'en-old-trivia',
          title: 'Old Trivia',
          quizType: 'trivia',
          locale: 'en',
          categoryName: null,
          coverImageUrl: '/stock-covers/en-old-trivia',
          minutes: 3,
          playedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          slug: 'es-nuevo',
          title: 'Nuevo',
          quizType: 'personality',
          locale: 'es',
          categoryName: 'Anime',
          coverImageUrl: null,
          minutes: 5,
          score: 'Goku',
          playedAt: '2026-02-01T00:00:00.000Z',
        },
      ])
    );
    const { container } = render(<RecentlyPlayed locale="es" />);
    await waitFor(() => expect(container.querySelectorAll('a.arcade-card')).toHaveLength(2));
    const cards = Array.from(container.querySelectorAll('a.arcade-card'));
    expect(cards[0]).toHaveClass('qv8-card');
    expect(cards[0].getAttribute('href')).toBe('/es/quiz/es-nuevo');
    expect(cards[0].textContent).toContain('5 min · Goku');
    expect(cards[1].getAttribute('href')).toBe('/en/quiz/en-old-trivia');
    expect(cards[1].querySelector('img')!.getAttribute('srcset')).toContain(
      '/stock-covers/en-old-trivia?w=320 320w'
    );
    // Sin título repetido sobre la portada.
    expect(container.querySelector('.arcade-cover-title')).toBeNull();
  });
});
