/**
 * Borrador del compositor manual.
 *
 * El formulario guarda la asignación opción→resultado por id, así renombrar un
 * tag no rompe el vínculo. Aquí se materializa en `personality_tags` y pasa por
 * las mismas piezas que el borrador de la IA: `validateQuiz` para los mensajes
 * localizados y `normalizeQuizDraft` antes de enviar a `createQuiz`.
 */

import { normalizeQuizDraft } from './normalize-draft';
import { validateQuiz, type ValidationResult } from './validator';
import type { PersonalityResult, Question } from '@/types/quiz';

export type CreatorQuizType = 'trivia' | 'personality';

export interface CreatorDraftInput {
  title: string;
  description: string;
  quizType: CreatorQuizType;
  difficulty: 'easy' | 'medium' | 'hard';
  categoryId: string;
  language: string;
  questions: Question[];
  results: PersonalityResult[];
  /** Id de opción → id del resultado al que suma. */
  assignments: Record<string, string>;
}

export type CreatorErrorTarget =
  | { kind: 'title' }
  | { kind: 'description' }
  | { kind: 'question'; index: number }
  | { kind: 'result'; index: number }
  | { kind: 'form' };

export interface CreatorError {
  message: string;
  target: CreatorErrorTarget;
}

/** Tag estable y ASCII a partir del título; el editor puede sobrescribirlo. */
export function tagFromTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function buildCreatorDraft(input: CreatorDraftInput) {
  const results = input.results.map((result) => ({
    ...result,
    title: result.title.trim(),
    description: result.description.trim(),
    image_url: result.image_url?.trim() || null,
    personality_tag: result.personality_tag?.trim() || undefined,
  }));
  const tagByResult = new Map<string, string | undefined>(
    results.map((result) => [result.id, result.personality_tag])
  );

  const questions = input.questions.map((question) => ({
    ...question,
    question: question.question.trim(),
    explanation: question.explanation?.trim() || null,
    image_url: question.image_url?.trim() || null,
    options: question.options.map((option) => {
      const text = option.text.trim();
      const image_url = option.image_url?.trim() || null;
      if (input.quizType === 'trivia')
        return { ...option, text, image_url, personality_tags: undefined };
      const tag = tagByResult.get(input.assignments[option.id] ?? '');
      return { ...option, text, image_url, personality_tags: tag ? [tag] : undefined };
    }),
  }));

  return {
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    quiz_type: input.quizType,
    difficulty: input.difficulty,
    language: input.language,
    category_id: input.categoryId || undefined,
    questions,
    results: input.quizType === 'personality' ? results : undefined,
    estimated_minutes: Math.max(1, questions.length),
  };
}

export function validateCreatorDraft(input: CreatorDraftInput, locale: string): ValidationResult {
  return validateQuiz(buildCreatorDraft(input), locale);
}

export function normalizeCreatorDraft(input: CreatorDraftInput) {
  return normalizeQuizDraft(buildCreatorDraft(input));
}

/**
 * ¿El grafo de resultados está listo, sin mirar el texto de preguntas y
 * opciones? Se valida un borrador con esos textos sustituidos por placeholders
 * para que un prompt vacío no marque los resultados como pendientes, pero sí lo
 * hagan un tag ausente, una opción sin voto o un resultado inalcanzable.
 */
export function resultGraphValid(input: CreatorDraftInput): boolean {
  if (input.quizType !== 'personality') return true;
  if (input.results.length < 2 || input.results.length > 6) return false;

  const draft = buildCreatorDraft(input);
  const probe = {
    ...draft,
    title: 'Result graph',
    description: undefined,
    category_id: undefined,
    questions: draft.questions.map((question, questionIndex) => ({
      ...question,
      question: `Pregunta ${questionIndex + 1}`,
      explanation: null,
      image_url: null,
      options: question.options.map((option, optionIndex) => ({
        ...option,
        text: `Opción ${optionIndex + 1}`,
        image_url: null,
      })),
    })),
  };

  return validateQuiz(probe, input.language).valid;
}

const QUESTION_PATH = /^questions\.(\d+)(?:\.|$)/;
const RESULT_PATH = /^results\.(\d+)(?:\.|$)/;
const QUESTION_MESSAGE = /^(?:Pregunta|Question) (\d+):/;
const RESULT_MESSAGE = /^(?:Resultado|Result) (\d+):/;

/**
 * Ubica un mensaje de `validateQuiz` en el campo que lo causó. Los errores
 * estructurales traen la ruta (`questions.2.options.0.text`) y los semánticos
 * traen el índice en el texto ("Pregunta 3: …"); el resto es del formulario.
 */
export function creatorErrorTarget(message: string): CreatorErrorTarget {
  const colon = message.indexOf(':');
  const path = colon === -1 ? '' : message.slice(0, colon);
  if (path === 'title') return { kind: 'title' };
  if (path === 'description') return { kind: 'description' };

  const questionPath = QUESTION_PATH.exec(path);
  if (questionPath) return { kind: 'question', index: Number(questionPath[1]) };
  const resultPath = RESULT_PATH.exec(path);
  if (resultPath) return { kind: 'result', index: Number(resultPath[1]) };

  const questionMessage = QUESTION_MESSAGE.exec(message);
  if (questionMessage) return { kind: 'question', index: Number(questionMessage[1]) - 1 };
  const resultMessage = RESULT_MESSAGE.exec(message);
  if (resultMessage) return { kind: 'result', index: Number(resultMessage[1]) - 1 };

  return { kind: 'form' };
}

export function creatorErrors(messages: string[]): CreatorError[] {
  return messages.map((message) => ({ message, target: creatorErrorTarget(message) }));
}
