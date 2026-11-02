import { getCoverTheme } from '@/lib/design/cover-system';
import type { Quiz } from '@/types/quiz';

export function buildQuizCoverSvg(
  quiz: Pick<Quiz, 'title' | 'description' | 'quiz_type' | 'category'>,
  variant: 'landscape' | 'portrait' = 'landscape'
) {
  return variant === 'portrait' ? portraitSvg(quiz) : landscapeSvg(quiz);
}

function landscapeSvg(quiz: Pick<Quiz, 'title' | 'description' | 'quiz_type' | 'category'>) {
  const theme = getCoverTheme(quiz);
  const letter = (quiz.category?.icon ?? quiz.title.charAt(0).toUpperCase()).slice(0, 1);
  const badge = quiz.quiz_type === 'personality' ? 'PERSONALITY' : 'TRIVIA';
  const titleLines = wrapText(quiz.title, 18);
  const categoryLabel = quiz.category?.name?.toUpperCase() ?? 'QUIZ';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1600" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.base}"/>
      <stop offset="0.58" stop-color="${theme.highlight}"/>
      <stop offset="1" stop-color="${theme.deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(262 162) rotate(45) scale(463 413)">
      <stop stop-color="white" stop-opacity="0.26"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" rx="40" fill="url(#bg)"/>
  <rect width="1600" height="900" rx="40" fill="url(#glow)"/>
  <rect width="1600" height="900" rx="40" fill="rgba(12,8,6,0.16)"/>
  <g opacity="0.12">
    <path d="M0 70H1600" stroke="white"/>
    <path d="M0 280H1600" stroke="white"/>
    <path d="M0 490H1600" stroke="white"/>
    <path d="M0 700H1600" stroke="white"/>
    <path d="M220 0V900" stroke="white"/>
    <path d="M600 0V900" stroke="white"/>
    <path d="M980 0V900" stroke="white"/>
    <path d="M1360 0V900" stroke="white"/>
  </g>
  <rect x="70" y="64" width="300" height="56" rx="28" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.18)"/>
  <text x="112" y="100" fill="white" font-family="Arial, sans-serif" font-size="18" letter-spacing="5.8">${escapeXml(badge)}</text>
  <rect x="0" y="620" width="1600" height="280" fill="rgba(12,8,6,0.42)"/>
  <rect x="70" y="690" width="220" height="70" rx="35" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)"/>
  <text x="180" y="734" text-anchor="middle" fill="#FFF8F2" font-family="Arial, sans-serif" font-size="20" letter-spacing="4">${escapeXml(
    categoryLabel
  )}</text>
  ${renderTspans(titleLines, 70, 792, 72, '#FFF8F2', true)}
  <rect x="1200" y="120" width="250" height="250" rx="78" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)"/>
  <text x="1325" y="270" text-anchor="middle" fill="#FFF8F2" font-family="Arial, sans-serif" font-size="120" font-weight="700">${escapeXml(letter)}</text>
  <text x="1284" y="790" fill="rgba(255,248,242,0.76)" font-family="Arial, sans-serif" font-size="22" text-anchor="end">QuizVerse</text>
</svg>`;
}

// Composición vertical para el panel lateral de la tarjeta OG del resultado
// (caja ~354×510): el recorte `cover` de la 16:9 cortaría título y monograma.
function portraitSvg(quiz: Pick<Quiz, 'title' | 'description' | 'quiz_type' | 'category'>) {
  const theme = getCoverTheme(quiz);
  const letter = (quiz.category?.icon ?? quiz.title.charAt(0).toUpperCase()).slice(0, 1);
  const badge = quiz.quiz_type === 'personality' ? 'PERSONALITY' : 'TRIVIA';
  const titleLines = wrapText(quiz.title, 15);
  const categoryLabel = quiz.category?.name?.toUpperCase() ?? 'QUIZ';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="840" height="1200" viewBox="0 0 840 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="840" y2="1200" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.base}"/>
      <stop offset="0.58" stop-color="${theme.highlight}"/>
      <stop offset="1" stop-color="${theme.deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(210 170) rotate(45) scale(320 420)">
      <stop stop-color="white" stop-opacity="0.26"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="840" height="1200" rx="36" fill="url(#bg)"/>
  <rect width="840" height="1200" rx="36" fill="url(#glow)"/>
  <rect width="840" height="1200" rx="36" fill="rgba(12,8,6,0.16)"/>
  <g opacity="0.12">
    <path d="M0 170H840" stroke="white"/>
    <path d="M0 450H840" stroke="white"/>
    <path d="M0 730H840" stroke="white"/>
    <path d="M0 1010H840" stroke="white"/>
    <path d="M150 0V1200" stroke="white"/>
    <path d="M360 0V1200" stroke="white"/>
    <path d="M570 0V1200" stroke="white"/>
    <path d="M780 0V1200" stroke="white"/>
  </g>
  <rect x="56" y="52" width="250" height="56" rx="28" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.18)"/>
  <text x="181" y="88" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="17" letter-spacing="4">${escapeXml(badge)}</text>
  <text x="784" y="88" text-anchor="end" fill="rgba(255,248,242,0.76)" font-family="Arial, sans-serif" font-size="20">QuizVerse</text>
  <rect x="250" y="180" width="340" height="340" rx="96" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)"/>
  <text x="420" y="408" text-anchor="middle" fill="#FFF8F2" font-family="Arial, sans-serif" font-size="160" font-weight="700">${escapeXml(letter)}</text>
  <rect x="0" y="840" width="840" height="360" fill="rgba(12,8,6,0.42)"/>
  <rect x="56" y="900" width="220" height="66" rx="33" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)"/>
  <text x="166" y="943" text-anchor="middle" fill="#FFF8F2" font-family="Arial, sans-serif" font-size="19" letter-spacing="4">${escapeXml(
    categoryLabel
  )}</text>
  ${renderTspans(titleLines, 56, 1040, 62, '#FFF8F2', true)}
</svg>`;
}

function renderTspans(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  bold: boolean
) {
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * 0.74}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `<text y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${fontSize}" ${
    bold ? 'font-weight="700"' : ''
  }>${tspans}</text>`;
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
