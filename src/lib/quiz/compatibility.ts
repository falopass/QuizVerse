/**
 * Compatibilidad entre amigos en tests de personalidad.
 *
 * Cuando alguien juega un test de personalidad desde el enlace de un amigo
 * (`?challenge=<token>`), los dos ven la misma comparación: «Tú eres Goku,
 * Camila es Vegeta: rivales eternos». La afinidad se calcula con la
 * similitud coseno de los vectores de `personality_tags` que cada partida
 * acumuló al responder — es simétrica y determinista, así que ambos
 * jugadores ven el mismo número. Módulo puro: sin servidor ni navegador.
 */

import type { Answer, Question } from '@/types/quiz';

/** Lo del amigo que la tarjeta necesita: su resultado y sus tags. Sin PII. */
export interface CompatibilityPeer {
  resultTitle: string | null;
  resultId: string | null;
  /** Tags de personalidad acumulados en la partida del amigo. */
  tags: string[];
}

export type CompatibilityTier = 'soulmates' | 'team' | 'opposites' | 'rivals';

export interface CompatibilityVerdict {
  /** 0–100; mismo número para los dos jugadores. */
  percent: number;
  tier: CompatibilityTier;
}

/** Mismo resultado ⇒ afinidad alta aunque las respuestas difieran un poco. */
const SAME_RESULT_FLOOR = 85;

/**
 * Tags que una partida acumuló: cada respuesta suma los `personality_tags`
 * de la opción elegida. Las respuestas a preguntas que ya no existen, las
 * omitidas (`selected_option_id` vacío) y las opciones sin tags no suman.
 */
export function personalityTagsFromAnswers(
  questions: Array<Pick<Question, 'id' | 'options'>>,
  answers: Array<Pick<Answer, 'question_id' | 'selected_option_id'>>
): string[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const tags: string[] = [];
  for (const answer of answers) {
    const question = byId.get(answer.question_id);
    const option = question?.options.find((item) => item.id === answer.selected_option_id);
    if (option?.personality_tags) tags.push(...option.personality_tags);
  }
  return tags;
}

/**
 * ¿Sacaron el mismo resultado? Se comparan los ids cuando ambos existen;
 * si falta alguno (sesiones antiguas sin result_id) se cae al título, que
 * en un mismo quiz e idioma identifica igual de bien.
 */
export function samePersonalityResult(
  mine: { resultId?: string | null; resultTitle?: string | null },
  theirs: { resultId?: string | null; resultTitle?: string | null }
): boolean {
  if (mine.resultId && theirs.resultId) return mine.resultId === theirs.resultId;
  return Boolean(mine.resultTitle && mine.resultTitle === theirs.resultTitle);
}

function toVector(tags: string[]): Map<string, number> {
  const vector = new Map<string, number>();
  for (const tag of tags) vector.set(tag, (vector.get(tag) ?? 0) + 1);
  return vector;
}

function tierFor(percent: number): CompatibilityTier {
  if (percent >= 85) return 'soulmates';
  if (percent >= 60) return 'team';
  if (percent >= 35) return 'opposites';
  return 'rivals';
}

/**
 * Afinidad de dos partidas de personalidad.
 *
 * `null` cuando alguna de las dos no acumuló tags (nada que comparar: mejor
 * no inventar un porcentaje). Con tags en ambos lados devuelve el coseno de
 * los vectores de frecuencia en porcentaje, con un piso de
 * `SAME_RESULT_FLOOR` cuando los dos sacaron el mismo resultado.
 */
export function compatibilityVerdict(
  myTags: string[],
  theirTags: string[],
  sameResult: boolean
): CompatibilityVerdict | null {
  const mine = toVector(myTags);
  const theirs = toVector(theirTags);
  if (mine.size === 0 || theirs.size === 0) return null;

  let dot = 0;
  let normMine = 0;
  let normTheirs = 0;
  for (const [tag, count] of mine) {
    normMine += count * count;
    dot += count * (theirs.get(tag) ?? 0);
  }
  for (const count of theirs.values()) normTheirs += count * count;

  const cosine = dot / (Math.sqrt(normMine) * Math.sqrt(normTheirs));
  let percent = Math.min(100, Math.max(0, Math.round(cosine * 100)));
  if (sameResult) percent = Math.max(percent, SAME_RESULT_FLOOR);

  return { percent, tier: tierFor(percent) };
}

/** Etiqueta del rango de afinidad, en el idioma de la interfaz. */
export function compatibilityLabel(tier: CompatibilityTier, locale: string): string {
  const es = locale === 'es';
  switch (tier) {
    case 'soulmates':
      return es ? 'Almas gemelas' : 'Soulmates';
    case 'team':
      return es ? 'Buen equipo' : 'Great team';
    case 'opposites':
      return es ? 'Polos opuestos que se atraen' : 'Opposites attract';
    case 'rivals':
      return es ? 'Rivales eternos' : 'Eternal rivals';
  }
}
