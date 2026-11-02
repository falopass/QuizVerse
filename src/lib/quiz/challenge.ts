/**
 * Reto entre amigos.
 *
 * Un enlace de desafío es la URL de un resultado ajeno (`/result?s=<token>`).
 * Quien lo abre ve la marca del retador y, al terminar, sabe si lo superó. Toda
 * la decisión es una comparación de marcadores; vive aquí para poder testearla
 * sin navegador ni base de datos.
 */

export interface ChallengeScore {
  score: number;
  maxScore: number;
  resultTitle?: string | null;
}

export interface ChallengeInfo extends ChallengeScore {
  token: string;
}

export type ChallengeOutcome = 'win' | 'tie' | 'lose';

/**
 * Formato real de `game_sessions.share_token`
 * (`encode(gen_random_bytes(8), 'hex')` → 16 hex en minúscula). Los tokens se
 * reflejan en canonical/og:url y en enlaces de reto: un string arbitrario
 * jamás llega a una URL pública.
 */
export function isShareToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
}

/** Compara dos marcadores. Empate cuando ambos aciertan lo mismo. */
export function challengeOutcome(mine: ChallengeScore, theirs: ChallengeScore): ChallengeOutcome {
  if (mine.score === theirs.score) return 'tie';
  return mine.score > theirs.score ? 'win' : 'lose';
}

/**
 * Texto del reto.
 *
 * En trivia el marcador es el protagonista; en personality el resultado
 * (`resultTitle`) dice más que un número, así que se usa cuando existe.
 */
export function challengeCopy(
  info: ChallengeScore,
  locale: string
): { eyebrow: string; title: string; body: string } {
  const es = locale === 'es';
  const hasScore = info.maxScore > 0;
  const mark = hasScore ? `${info.score}/${info.maxScore}` : null;
  const label = info.resultTitle ?? mark;

  if (es) {
    return {
      eyebrow: 'Te retaron',
      title: label ? `Alguien sacó ${label}` : 'Alguien te retó',
      body: label
        ? `Este es el marcador de tu amigo en este quiz. ¿Puedes superarlo?`
        : 'Completa el quiz y compara tu resultado.',
    };
  }

  return {
    eyebrow: 'You were challenged',
    title: label ? `A friend scored ${label}` : 'A friend challenged you',
    body: label
      ? 'That is their score on this quiz. Can you beat it?'
      : 'Finish the quiz and compare your result.',
  };
}

/** Cierra el reto: qué decirle al jugador después de su partida. */
export function challengeVerdictCopy(
  outcome: ChallengeOutcome,
  info: ChallengeScore,
  locale: string
): string {
  const es = locale === 'es';
  const mark = info.maxScore > 0 ? `${info.score}/${info.maxScore}` : null;
  const label = info.resultTitle ?? mark ?? '';

  if (es) {
    if (outcome === 'win') return `Superaste el reto: ${label}`;
    if (outcome === 'tie') return `Empate con el reto: ${label}`;
    return `El reto sigue en pie: ${label}`;
  }

  if (outcome === 'win') return `You beat the challenge: ${label}`;
  if (outcome === 'tie') return `Tied with the challenge: ${label}`;
  return `The challenge stands: ${label}`;
}
