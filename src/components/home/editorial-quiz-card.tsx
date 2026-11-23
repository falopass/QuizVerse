import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { LARGE_COVER_SIZES, QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { accentForCategory } from '@/lib/design/franchise-palette';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category, Quiz } from '@/types/quiz';

/**
 * Lo que pinta la tarjeta. Es un subconjunto de `Quiz` para que el explorador
 * pueda pasar su fila liviana sin arrastrar el quiz completo al payload RSC.
 */
type EditorialQuizCardQuiz = Pick<
  Quiz,
  'slug' | 'title' | 'quiz_type' | 'estimated_minutes' | 'cover_image_url'
> & { category?: (Pick<Category, 'name'> & { slug?: string | null }) | null };

/**
 * Las dos cadenas de la tarjeta, espejo de `arcade.play` y `common.minutesShort`
 * del diccionario (lo vigila tests/quiz-cover-art.test.tsx). Viven aquí para
 * que la tarjeta, que también monta en cliente (explorar, recientes,
 * resultado), no arrastre el diccionario completo al bundle (D-04).
 */
export const CARD_COPY = {
  es: { play: 'Jugar', minutesShort: 'min' },
  en: { play: 'Play', minutesShort: 'min' },
} as const satisfies Record<Locale, { play: string; minutesShort: string }>;

interface EditorialQuizCardProps {
  quiz: EditorialQuizCardQuiz;
  locale: Locale;
  index?: number;
  size?: 'hero' | 'feature' | 'default' | 'compact';
  /** Pisa la regla por fila para tarjetas que no abren una grilla (p. ej. relacionados). */
  prefetch?: boolean;
  /** Locale del enlace cuando difiere de la UI: un reciente solo existe en el idioma donde se jugó. */
  hrefLocale?: Locale;
  /** Dato real extra para el pie (p. ej. el marcador de un reciente). */
  extraMeta?: string | null;
}

/** Primera fila de la grilla (3 columnas en escritorio): solo esas prefetchean. */
const PREFETCH_FIRST_ROW = 3;

export function EditorialQuizCard({
  quiz,
  locale,
  index,
  size = 'default',
  prefetch,
  hrefLocale,
  extraMeta,
}: EditorialQuizCardProps) {
  const copy = CARD_COPY[locale] ?? CARD_COPY.en;
  // Acento de la franquicia (categoría) o, sin categoría conocida, del tipo de
  // juego: la tarjeta publica --qv-* y el CSS (bloque L8) los consume.
  const accent =
    accentForCategory(quiz.category?.slug) ?? accentForCategory(quiz.quiz_type) ?? undefined;
  const accentVars = accent
    ? ({
        '--qv-accent': accent.accent,
        '--qv-accent-soft': accent.soft,
        '--qv-on-accent': accent.onAccent,
      } as CSSProperties)
    : undefined;
  // El lead editorial abre su propia sección sin h2 previo: ahí el titular es h2.
  const isHero = size === 'hero';
  const TitleTag = isHero ? 'h2' : 'h3';
  return (
    <Link
      href={localizeHref(hrefLocale ?? locale, `/quiz/${quiz.slug}`)}
      prefetch={prefetch ?? (index === undefined || index < PREFETCH_FIRST_ROW)}
      className={cn('arcade-card qv8-card', isHero && 'arcade-card-hero')}
      style={accentVars}
    >
      <QuizCoverArt
        quiz={quiz}
        locale={locale}
        compact
        decorative
        showTitle={false}
        className="arcade-card-art"
        // El destacado queda vertical también en móvil (fuera de la fila de 96 px).
        sizes={isHero ? LARGE_COVER_SIZES : undefined}
      />
      <div className="arcade-card-info">
        <span className="arcade-card-meta">
          <span className="qv8-card-type">{getLocalizedTypeLabel(quiz.quiz_type, locale)}</span>
          {' · '}
          {quiz.category?.name ?? 'QuizVerse'}
        </span>
        <TitleTag>{quiz.title}</TitleTag>
        <div className="arcade-card-bottom">
          <small>
            {quiz.estimated_minutes} {copy.minutesShort}
            {extraMeta ? ` · ${extraMeta}` : ''}
          </small>
          <span className="arcade-card-play">
            {copy.play} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
