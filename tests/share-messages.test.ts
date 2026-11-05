import { describe, expect, it } from 'vitest';
import {
  SHARE_CHANNELS,
  X_TEXT_LIMIT,
  shareText,
  urlWithVia,
  type ShareContext,
} from '@/lib/share/messages';

const trivia: ShareContext = {
  kind: 'trivia_result',
  slug: 'trivia-de-messi',
  title: 'Trivia de Messi',
  score: 7,
  maxScore: 8,
};
const personality: ShareContext = {
  kind: 'personality_result',
  slug: 'que-personaje-de-dragon-ball-eres',
  title: '¿Qué personaje de Dragon Ball eres?',
  resultTitle: 'Goku',
};
const invite: ShareContext = {
  kind: 'quiz_invite',
  slug: 'trivia-de-messi',
  title: 'Trivia de Messi',
};

describe('shareText', () => {
  it('es trivia: incluye marcador, título y gancho', () => {
    const text = shareText(trivia, 'es');
    expect(text).toContain('7/8');
    expect(text).toContain('Trivia de Messi');
    expect(text).toMatch(/¿|\?|!/);
  });

  it('en trivia: includes score and title', () => {
    const text = shareText(trivia, 'en');
    expect(text).toContain('7/8');
    expect(text).toContain('Trivia de Messi');
  });

  it('es personality: menciona el resultado y pregunta por el del otro', () => {
    const text = shareText(personality, 'es');
    expect(text).toContain('Goku');
    expect(text).toContain('Dragon Ball');
  });

  it('invite sin resultado: invita con el título', () => {
    expect(shareText(invite, 'es')).toContain('Trivia de Messi');
    expect(shareText(invite, 'en')).toContain('Trivia de Messi');
  });

  it('español neutro: no usa voseo', () => {
    const all = [trivia, personality, invite].flatMap((c) => [
      shareText(c, 'es'),
      shareText(c, 'es', 'x'),
    ]);
    for (const text of all) {
      expect(text).not.toMatch(/\b(ganás|podés|superás|animás|sacaste|vos)\b/i);
    }
  });

  it('es determinista por quiz: mismo slug, mismo texto', () => {
    expect(shareText(trivia, 'es')).toBe(shareText(trivia, 'es'));
    const otherSlug = { ...trivia, slug: 'otro-quiz' };
    // No exige texto distinto, solo que sea una de las variantes válidas.
    expect(shareText(otherSlug, 'es')).toContain('7/8');
  });

  it('x: el texto queda bajo el límite aunque el título sea largo', () => {
    const long: ShareContext = {
      ...trivia,
      title: 'Trivia de '.padEnd(300, 'x'),
    };
    expect(shareText(long, 'es', 'x').length).toBeLessThanOrEqual(X_TEXT_LIMIT);
    expect(shareText(long, 'en', 'x').length).toBeLessThanOrEqual(X_TEXT_LIMIT);
  });

  it('x: título y resultado largos no reventan el límite', () => {
    const long: ShareContext = {
      ...personality,
      title: 'Q'.padEnd(120, 'uiz '),
      resultTitle: 'R'.padEnd(100, 'esult '),
    };
    expect(shareText(long, 'es', 'x').length).toBeLessThanOrEqual(X_TEXT_LIMIT);
    expect(shareText(long, 'en', 'x').length).toBeLessThanOrEqual(X_TEXT_LIMIT);
  });
});

describe('urlWithVia', () => {
  it.each(SHARE_CHANNELS)('añade via=%s a una URL absoluta', (channel) => {
    expect(urlWithVia('https://quizverse.org/es/quiz/messi', channel)).toBe(
      `https://quizverse.org/es/quiz/messi?via=${channel}`
    );
  });

  it('conserva parámetros existentes (s, challenge, g)', () => {
    const url = urlWithVia('https://quizverse.org/es/quiz/messi?s=abc&challenge=def&g=1', 'x');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('s')).toBe('abc');
    expect(parsed.searchParams.get('challenge')).toBe('def');
    expect(parsed.searchParams.get('g')).toBe('1');
    expect(parsed.searchParams.get('via')).toBe('x');
  });

  it('reemplaza un via anterior en vez de duplicarlo', () => {
    const url = urlWithVia('https://quizverse.org/es/quiz/messi?via=whatsapp', 'x');
    expect(url.match(/via=/g)).toHaveLength(1);
    expect(new URL(url).searchParams.get('via')).toBe('x');
  });

  it('funciona con URLs relativas y conserva el hash', () => {
    expect(urlWithVia('/es/quiz/messi?challenge=abc#top', 'copy')).toBe(
      '/es/quiz/messi?challenge=abc&via=copy#top'
    );
  });
});
