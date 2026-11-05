/**
 * Mensajes para compartir y marcación `?via=` de los enlaces.
 *
 * Puro y determinista: la variante del texto se elige con un hash del slug,
 * así el mismo quiz siempre propone la misma frase (sin azar por clic).
 */

import type { Locale } from '@/lib/i18n/dictionaries';

export const SHARE_CHANNELS = [
  'whatsapp',
  'x',
  'telegram',
  'facebook',
  'copy',
  'native',
  'embed',
] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export type ShareContext =
  | { kind: 'trivia_result'; slug: string; title: string; score: number; maxScore: number }
  | { kind: 'personality_result'; slug: string; title: string; resultTitle: string }
  | { kind: 'quiz_invite'; slug: string; title: string };

/** Texto que acompaña el enlace en X: margen bajo el límite de 280. */
export const X_TEXT_LIMIT = 220;

/** Hash estable (FNV-1a de 32 bits) para escoger la variante sin azar. */
export function variantIndex(seed: string, count: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % Math.max(1, count);
}

/** Recorta el título para que el mensaje quepa en `limit` caracteres. */
function fitTitle(title: string, limit: number): string {
  return title.length <= limit ? title : `${title.slice(0, Math.max(0, limit - 1))}…`;
}

function variants(context: ShareContext, locale: Locale): string[] {
  const es = locale === 'es';
  switch (context.kind) {
    case 'trivia_result':
      return es
        ? [
            `Saqué ${context.score}/${context.maxScore} en ${context.title} 🏆 ¿Me ganas?`,
            `${context.score}/${context.maxScore} en ${context.title} — ¿superas mi marca?`,
            `Llegué a ${context.score}/${context.maxScore} en ${context.title}. A ver si puedes más.`,
          ]
        : [
            `I got ${context.score}/${context.maxScore} on ${context.title} 🏆 Can you beat me?`,
            `${context.score}/${context.maxScore} on ${context.title} — think you can top that?`,
            `Scored ${context.score}/${context.maxScore} on ${context.title}. Your turn.`,
          ];
    case 'personality_result':
      return es
        ? [
            `Me salió ${context.resultTitle} en ${context.title} ¿Y a ti?`,
            `Mi resultado en ${context.title}: ${context.resultTitle} — ¿cuál es el tuyo?`,
          ]
        : [
            `I got ${context.resultTitle} in ${context.title}. And you?`,
            `My ${context.title} result: ${context.resultTitle} — what's yours?`,
          ];
    case 'quiz_invite':
      return es
        ? [`Este quiz te va a gustar: ${context.title}`, `¿Te animas con ${context.title}?`]
        : [`Worth a try: ${context.title}`, `Think you can beat ${context.title}?`];
  }
}

/**
 * Texto a compartir para `context` y `locale`. En `x` el título se recorta
 * para que el mensaje quede bajo `X_TEXT_LIMIT`.
 */
export function shareText(context: ShareContext, locale: Locale, channel?: ShareChannel): string {
  // En X también se acota el resultado: título de 120 + resultado de 100
  // reventarían el límite aunque cada uno cumpla los suyos.
  const titleCap = channel === 'x' ? 90 : context.title.length;
  const fitted = { ...context, title: fitTitle(context.title, titleCap) };
  if (fitted.kind === 'personality_result' && channel === 'x') {
    fitted.resultTitle = fitTitle(fitted.resultTitle, 90);
  }
  const options = variants(fitted, locale);
  const text = options[variantIndex(context.slug || context.title, options.length)];
  return channel === 'x' && text.length > X_TEXT_LIMIT
    ? `${text.slice(0, X_TEXT_LIMIT - 1)}…`
    : text;
}

/**
 * Devuelve `url` con `?via=<channel>` añadido, conservando los parámetros
 * existentes (`s`, `challenge`, `g`, …). Si ya hay `via`, se reemplaza.
 */
export function urlWithVia(url: string, channel: ShareChannel): string {
  const parsed = new URL(url, 'https://quizverse.invalid');
  parsed.searchParams.set('via', channel);
  return parsed.origin === 'https://quizverse.invalid'
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : parsed.toString();
}
