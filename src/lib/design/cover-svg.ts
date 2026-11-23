import { coverArtSpec, coverMotifMarkup, type CoverArtSpec } from '@/lib/design/franchise-palette';
import type { Quiz } from '@/types/quiz';

type CoverSvgQuiz = Pick<Quiz, 'title' | 'description' | 'quiz_type' | 'category'> & {
  slug?: string;
};

/**
 * Portada SVG servida por `/covers`, el fallback de `/stock-covers` y la OG.
 * Comparte la regla gráfica con la tarjeta (`coverArtSpec` + `coverMotifMarkup`):
 * mismo motivo por categoría, mismas variaciones por slug.
 *
 * - `landscape` (1600×900): arte + banda con tipo, categoría y título.
 * - `portrait` (840×1200): panel lateral de la OG del resultado.
 * - `art` (1200×800, 3:2): solo arte e inicial, sin texto; lo usa el fallback
 *   de la foto stock, porque la tarjeta y la ficha ya imprimen el título.
 */
export function buildQuizCoverSvg(
  quiz: CoverSvgQuiz,
  variant: 'landscape' | 'portrait' | 'art' = 'landscape'
) {
  if (variant === 'art') return artSvg(quiz);
  return variant === 'portrait' ? portraitSvg(quiz) : landscapeSvg(quiz);
}

function specFor(quiz: CoverSvgQuiz, forceMode?: 'pleno' | 'night'): CoverArtSpec {
  return coverArtSpec(
    {
      slug: quiz.slug ?? quiz.title,
      title: quiz.title,
      quizType: quiz.quiz_type,
      categorySlug: quiz.category?.slug ?? null,
    },
    forceMode
  );
}

const DISPLAY_FONT = "'Archivo Black', 'Arial Black', Arial, sans-serif";

function glyphText(spec: CoverArtSpec, x: number, y: number, size: number) {
  const fill = spec.mode === 'night' ? spec.accent : '#101019';
  return `<text x="${x + size * 0.05}" y="${y + size * 0.05}" fill="${spec.second}" font-family="${DISPLAY_FONT}" font-size="${size}" font-weight="900" text-anchor="end">${escapeXml(spec.glyph)}</text><text x="${x}" y="${y}" fill="${fill}" font-family="${DISPLAY_FONT}" font-size="${size}" font-weight="900" text-anchor="end">${escapeXml(spec.glyph)}</text>`;
}

function artSvg(quiz: CoverSvgQuiz) {
  const spec = specFor(quiz);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="800" fill="${spec.field}"/>
  ${coverMotifMarkup(spec, 1200, 800)}
  ${glyphText(spec, 1150, 860, 720)}
</svg>`;
}

function landscapeSvg(quiz: CoverSvgQuiz) {
  const spec = specFor(quiz, 'night');
  const badge = quiz.quiz_type === 'personality' ? 'PERSONALITY' : 'TRIVIA';
  const titleLines = wrapText(quiz.title, 18);
  const categoryLabel = quiz.category?.name?.toUpperCase() ?? 'QUIZ';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="900" fill="${spec.field}"/>
  ${coverMotifMarkup(spec, 1600, 900)}
  ${glyphText(spec, 1540, 640, 620)}
  <rect x="70" y="64" width="300" height="56" rx="28" fill="${spec.accent}"/>
  <text x="220" y="100" text-anchor="middle" fill="#101019" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">${escapeXml(badge)}</text>
  <rect x="0" y="600" width="1600" height="300" fill="#101019" fill-opacity="0.86"/>
  <rect x="0" y="600" width="1600" height="10" fill="${spec.accent}"/>
  <text x="70" y="668" fill="${spec.accent}" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4">${escapeXml(
    categoryLabel
  )}</text>
  ${renderTspans(titleLines, 70, 752, 64, '#F6F3FF')}
  <text x="1530" y="860" fill="rgba(246,243,255,0.76)" font-family="Arial, sans-serif" font-size="22" text-anchor="end">QuizVerse</text>
</svg>`;
}

// Composición vertical para el panel lateral de la tarjeta OG del resultado
// (caja ~354×510): el recorte `cover` de la 16:9 cortaría título e inicial.
function portraitSvg(quiz: CoverSvgQuiz) {
  const spec = specFor(quiz, 'night');
  const badge = quiz.quiz_type === 'personality' ? 'PERSONALITY' : 'TRIVIA';
  const titleLines = wrapText(quiz.title, 15);
  const categoryLabel = quiz.category?.name?.toUpperCase() ?? 'QUIZ';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="840" height="1200" viewBox="0 0 840 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="840" height="1200" fill="${spec.field}"/>
  ${coverMotifMarkup(spec, 840, 1200)}
  ${glyphText(spec, 800, 780, 640)}
  <rect x="56" y="52" width="250" height="56" rx="28" fill="${spec.accent}"/>
  <text x="181" y="88" text-anchor="middle" fill="#101019" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="4">${escapeXml(badge)}</text>
  <text x="784" y="88" text-anchor="end" fill="rgba(246,243,255,0.76)" font-family="Arial, sans-serif" font-size="20">QuizVerse</text>
  <rect x="0" y="840" width="840" height="360" fill="#101019" fill-opacity="0.86"/>
  <rect x="0" y="840" width="840" height="10" fill="${spec.accent}"/>
  <text x="56" y="920" fill="${spec.accent}" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="4">${escapeXml(
    categoryLabel
  )}</text>
  ${renderTspans(titleLines, 56, 1010, 58, '#F6F3FF')}
</svg>`;
}

function renderTspans(lines: string[], x: number, y: number, fontSize: number, fill: string) {
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * 1.02}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `<text y="${y}" fill="${fill}" font-family="${DISPLAY_FONT}" font-size="${fontSize}" font-weight="700">${tspans}</text>`;
}

function wrapText(text: string, maxLength = 22) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = `${lines[2]}…`;
  }
  return lines;
}

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
