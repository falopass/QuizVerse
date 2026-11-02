/**
 * Repara el borrador que sale de los editores de creación antes de enviarlo a
 * `createQuiz`.
 *
 * La validación semántica del servidor exige ids únicos (preguntas, opciones y
 * resultados) y, en personality, un grafo completo de tags: cada resultado con
 * `personality_tag` único, cada opción votando por un tag existente y cada
 * resultado alcanzable. El editor no tiene UI para editar esos vínculos, así
 * que el borrador se normaliza aquí: los vínculos válidos se conservan y los
 * rotos o ausentes se reconstruyen de forma determinista.
 */

import type { PersonalityResult, Question } from '@/types/quiz';

const suffix = () => crypto.randomUUID().slice(0, 8);

function uniqueId(used: Set<string>, id: string | undefined, prefix: string): string {
  let next = id?.trim() || `${prefix}-${suffix()}`;
  while (used.has(next)) next = `${next}-${suffix()}`;
  used.add(next);
  return next;
}

interface DraftLike {
  quiz_type: string;
  questions: Question[];
  results?: PersonalityResult[];
}

export function normalizeQuizDraft<T extends DraftLike>(draft: T): T {
  const questionIds = new Set<string>();
  const questions = draft.questions.map((question, questionIndex) => {
    const optionIds = new Set<string>();
    return {
      ...question,
      id: uniqueId(questionIds, question.id, `q-${questionIndex + 1}`),
      options: question.options.map((option, optionIndex) => ({
        ...option,
        id: uniqueId(optionIds, option.id, `o-${optionIndex + 1}`),
      })),
    };
  });

  if (draft.quiz_type !== 'personality') return { ...draft, questions };

  const resultIds = new Set<string>();
  const takenTags = new Set<string>();
  const results = (draft.results ?? []).map((result, index) => {
    let tag = result.personality_tag?.trim() || `result-${index + 1}`;
    while (takenTags.has(tag)) tag = `${tag}-${index + 1}`;
    takenTags.add(tag);
    return {
      ...result,
      id: uniqueId(resultIds, result.id, `r-${index + 1}`),
      personality_tag: tag,
    };
  });

  const tags = results
    .map((result) => result.personality_tag)
    .filter((tag): tag is string => Boolean(tag));
  if (!tags.length || !questions.length) return { ...draft, questions, results };

  // Toda opción vota por un tag existente: se conservan los vínculos válidos y
  // las opciones sin tag (o con tags fantasma) reparten los tags disponibles.
  const linked = questions.map((question, questionIndex) => ({
    ...question,
    options: question.options.map((option, optionIndex) => {
      const kept = (option.personality_tags ?? []).filter((tag) => takenTags.has(tag));
      return {
        ...option,
        personality_tags: kept.length ? kept : [tags[(questionIndex + optionIndex) % tags.length]],
      };
    }),
  }));

  // Todo resultado debe ser alcanzable: un tag sin voto se añade a la primera
  // opción de otra pregunta.
  const used = new Set(
    linked.flatMap((question) =>
      question.options.flatMap((option) => option.personality_tags ?? [])
    )
  );
  tags.forEach((tag, index) => {
    if (used.has(tag)) return;
    const option = linked[index % linked.length].options[0];
    if (!option) return;
    option.personality_tags = [...(option.personality_tags ?? []), tag];
  });

  return { ...draft, questions: linked, results };
}
