import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { coverArtSpec, coverMotifMarkup } from '@/lib/design/franchise-palette';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category, Quiz } from '@/types/quiz';

interface QuizCoverArtProps {
  quiz: Pick<Quiz, 'slug' | 'title' | 'quiz_type' | 'cover_image_url'> & {
    category?: (Pick<Category, 'name'> & { slug?: string | null }) | null;
  };
  locale: Locale;
  className?: string;
  ratioClassName?: string;
  compact?: boolean;
  priorityLabel?: string;
  /**
   * Set where the title is already read out next to the poster (card, detail
   * page, hero link). Without it the same title reaches assistive tech twice:
   * once as the image label and once as the heading.
   */
  decorative?: boolean;
  /** Prints the title over the artwork. Cards repeat it next to the poster: there it is noise. */
  showTitle?: boolean;
  /** `sizes` de la foto stock; por defecto, el de la tarjeta (compact) o el de ficha/hero. */
  sizes?: string;
}

/**
 * Variantes que sirve `/stock-covers/[slug]?w=`: 320 cubre la fila móvil de
 * 96 px a 3x, 640 la tarjeta de grilla a 1.5x y 960 la ficha y el hero a 2x.
 */
export const STOCK_COVER_WIDTHS = [320, 640, 960] as const;

// Tarjeta: fila de 96 px bajo 640, una columna a todo el ancho hasta 699, dos
// columnas hasta 900 y tres (~430 px) por encima.
const CARD_SIZES =
  '(max-width: 639px) 96px, (max-width: 699px) 100vw, (max-width: 900px) 50vw, 430px';
export const LARGE_COVER_SIZES = '(max-width: 699px) 100vw, 50vw';

/** Añade `w=` a la URL versionada (`?v=`) sin perder la versión: el ancho entra en la clave de caché. */
export function stockCoverVariant(src: string, width: number): string {
  return `${src}${src.includes('?') ? '&' : '?'}w=${width}`;
}

/**
 * Poster cover for a quiz. The type is the artwork, so the size is bucketed by
 * title length instead of by viewport: a 64-character Spanish title and a
 * 12-character one cannot share a type size without one of them being clipped.
 */
function titleBucket(title: string, compact: boolean) {
  if (compact && title.length <= 24) return 'medium';
  if (title.length <= 24) return 'short';
  if (title.length <= 42) return 'medium';
  return 'long';
}

export function QuizCoverArt({
  quiz,
  locale,
  className,
  ratioClassName,
  compact = false,
  priorityLabel,
  decorative = false,
  showTitle = true,
  sizes,
}: QuizCoverArtProps) {
  const src = quiz.cover_image_url?.startsWith('/stock-covers/') ? quiz.cover_image_url : null;
  // Above-the-fold se deduce de las props sin un prop nuevo: el hero pasa
  // decorative + priorityLabel con texto y el detalle pasa priorityLabel="";
  // las tarjetas no la pasan (undefined) y quedan en lazy.
  const isHero = decorative && typeof priorityLabel === 'string' && priorityLabel.trim() !== '';
  const isAboveFold = isHero || priorityLabel === '';
  const artTitle = quiz.title.trim();
  const bucket = titleBucket(artTitle, compact);
  // Arte propio para null, /covers/ y como capa bajo la foto: si el <img> no
  // carga (alt="" no pinta icono roto), queda el arte y nunca una caja vacía.
  // Con el título impreso encima, campo pleno: tinta sobre acento (AA).
  const spec = coverArtSpec(
    {
      slug: quiz.slug,
      title: artTitle,
      quizType: quiz.quiz_type,
      categorySlug: quiz.category?.slug ?? null,
    },
    showTitle ? 'pleno' : undefined
  );
  const artVars = {
    '--qv8-field': spec.field,
    '--qv8-ink': spec.ink,
    '--qv8-second': spec.second,
    '--qv8-accent': spec.accent,
  } as CSSProperties;
  return (
    <div
      className={cn(
        'arcade-cover qv8-cover',
        `qv8-cover-${spec.mode}`,
        src && 'qv8-cover-has-photo',
        quiz.quiz_type === 'trivia' && 'arcade-cover-trivia',
        ratioClassName,
        className
      )}
      style={artVars}
      data-motif={spec.motif}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : quiz.title}
      aria-hidden={decorative || undefined}
    >
      <svg
        className="qv8-art"
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
        // Marcado generado solo con números y colores de la paleta (sin texto
        // de usuario): ver coverMotifMarkup.
        dangerouslySetInnerHTML={{ __html: coverMotifMarkup(spec) }}
      />
      {src && (
        // /stock-covers/ puede responder un SVG de fallback si el proveedor
        // falla y next/image rechaza SVG (400): se sirve sin el optimizador.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          srcSet={STOCK_COVER_WIDTHS.map((w) => `${stockCoverVariant(src, w)} ${w}w`).join(', ')}
          sizes={sizes ?? (compact ? CARD_SIZES : LARGE_COVER_SIZES)}
          alt=""
          className="arcade-cover-photo"
          // Variante 3:2; el CSS la recorta con object-fit: cover.
          width={960}
          height={640}
          loading={isAboveFold ? 'eager' : 'lazy'}
          fetchPriority={isAboveFold ? 'high' : undefined}
          decoding="async"
        />
      )}
      {!showTitle && (
        <span className="qv8-glyph" aria-hidden="true">
          {spec.glyph}
        </span>
      )}
      {priorityLabel !== '' && (
        <span className="arcade-cover-stamp">
          {priorityLabel ?? getLocalizedTypeLabel(quiz.quiz_type, locale)}
        </span>
      )}
      {showTitle && (
        <strong className={cn('arcade-cover-title', `arcade-cover-title-${bucket}`)}>
          {artTitle}
        </strong>
      )}
    </div>
  );
}
