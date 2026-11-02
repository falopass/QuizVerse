/**
 * Validador de estructura de Quiz usando Zod
 */

import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const OptionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(500),
  is_correct: z.boolean().optional(),
  personality_tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional().nullable(),
});

const QuestionSchema = z.object({
  id: z.string().min(1).max(64),
  question: z.string().min(1).max(1000),
  image_url: z.string().url().optional().nullable(),
  options: z.array(OptionSchema).min(2).max(10),
  explanation: z.string().max(500).optional().nullable(),
  time_limit_seconds: z.number().min(5).max(300).optional().nullable(),
});

const PersonalityResultSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  image_url: z.string().url().optional().nullable(),
  min_score: z.number().optional(),
  max_score: z.number().optional(),
  personality_tag: z.string().optional().nullable(),
  background_theme: z.enum(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']).optional(),
});

export const QuizCreateSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().max(300).optional().nullable(),
  cover_image_url: z.string().url().optional().nullable(),
  // La DB conserva 'poll' en su enum; vuelve a las entradas cuando exista implementación completa (puntuación incluida).
  quiz_type: z.enum(['trivia', 'personality']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  language: z.string().min(2).max(10).default('en'),
  category_id: z.string().uuid().optional().nullable(),
  questions: z.array(QuestionSchema).min(1).max(20),
  results: z.array(PersonalityResultSchema).optional().nullable(),
  // Mismo tope por etiqueta que AIQuizResponseSchema y que updateQuiz: crear
  // y editar deben compartir la regla o un quiz válido dejaría de ser editable.
  tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
  estimated_minutes: z.number().min(1).max(30).optional().default(3),
});

// Respuesta cruda del generador AI (DeepSeek): mismo contrato que pide el prompt
// en src/lib/quiz/generator.ts. No incluye quiz_type/difficulty/language porque
// esos los fija la request, no el modelo.
const AIOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
  is_correct: z.boolean().optional(),
  personality_tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional().nullable(),
});

const AIQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(1000),
  options: z.array(AIOptionSchema).min(2).max(6),
  explanation: z.string().max(500).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  time_limit_seconds: z.number().min(5).max(300).optional().nullable(),
});

const AIResultSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  personality_tag: z.string().optional().nullable(),
  background_theme: z.enum(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']).optional(),
  image_url: z.string().url().optional().nullable(),
  min_score: z.number().optional(),
  max_score: z.number().optional(),
});

export const AIQuizResponseSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().max(300),
  questions: z.array(AIQuestionSchema).min(3).max(20),
  results: z.array(AIResultSchema).min(3).max(8).optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10),
  estimated_minutes: z.number().min(1).max(30),
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type QuestionInput = z.infer<typeof QuestionSchema>;
export type OptionInput = z.infer<typeof OptionSchema>;
export type PersonalityResultInput = z.infer<typeof PersonalityResultSchema>;
export type QuizCreateInput = z.infer<typeof QuizCreateSchema>;

// ============================================
// FUNCIONES DE VALIDACIÓN
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Errores semánticos, bilingües: `createQuiz` los devuelve al formulario, que
// los muestra tal cual (ver `ActionFailure.error`). El locale es el `language`
// del quiz enviado, que los formularios fijan al locale de la UI.
const semantic = {
  uniqueQuestionIds: {
    es: 'Las preguntas deben tener identificadores únicos',
    en: 'Questions must have unique identifiers',
  },
  uniqueOptionIds: (index: number) => ({
    es: `Pregunta ${index + 1}: las opciones deben tener identificadores únicos`,
    en: `Question ${index + 1}: options must have unique identifiers`,
  }),
  singleCorrectOption: (index: number, count: number) => ({
    es: `Pregunta ${index + 1}: debe tener exactamente una respuesta correcta (tiene ${count})`,
    en: `Question ${index + 1}: must have exactly one correct answer (has ${count})`,
  }),
  resultsRequired: {
    es: 'Los quizzes de personalidad deben tener resultados definidos',
    en: 'Personality quizzes must define results',
  },
  uniqueResultTags: {
    es: 'Cada resultado debe tener un tag de personalidad único y no vacío',
    en: 'Every result must have a unique, non-empty personality tag',
  },
  uniqueResultIds: {
    es: 'Los resultados deben tener identificadores únicos',
    en: 'Results must have unique identifiers',
  },
  existingResultTags: (index: number) => ({
    es: `Pregunta ${index + 1}: cada opción debe usar tags de resultados existentes`,
    en: `Question ${index + 1}: every option must use tags of existing results`,
  }),
  unusedResultTag: (index: number, tag: string) => ({
    es: `Resultado ${index + 1}: el tag "${tag}" no se usa en ninguna opción`,
    en: `Result ${index + 1}: the tag "${tag}" is not used by any option`,
  }),
};

/**
 * Valida un quiz completo. `locale` decide el idioma de los errores semánticos
 * porque el caller los muestra al usuario final.
 */
export function validateQuiz(data: unknown, locale: string = 'es'): ValidationResult {
  const lang = locale === 'es' ? 'es' : 'en';
  const result = QuizCreateSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return { valid: false, errors };
  }

  // Validaciones adicionales específicas
  const additionalErrors: string[] = [];
  if (
    new Set(result.data.questions.map((question) => question.id)).size !==
    result.data.questions.length
  ) {
    additionalErrors.push(semantic.uniqueQuestionIds[lang]);
  }
  result.data.questions.forEach((question, index) => {
    if (new Set(question.options.map((option) => option.id)).size !== question.options.length) {
      additionalErrors.push(semantic.uniqueOptionIds(index)[lang]);
    }
  });

  // Para trivia: cada pregunta debe tener exactamente una respuesta correcta
  if (result.data.quiz_type === 'trivia') {
    result.data.questions.forEach((q, index) => {
      const correctOptions = q.options.filter((o) => o.is_correct === true);
      if (correctOptions.length !== 1) {
        additionalErrors.push(semantic.singleCorrectOption(index, correctOptions.length)[lang]);
      }
    });
  }

  // Para personality: debe tener resultados y los tags deben coincidir
  if (result.data.quiz_type === 'personality') {
    if (!result.data.results || result.data.results.length === 0) {
      additionalErrors.push(semantic.resultsRequired[lang]);
    } else {
      const resultTags = new Set(result.data.results.map((item) => item.personality_tag));
      if (
        resultTags.has(null) ||
        resultTags.has(undefined) ||
        resultTags.has('') ||
        resultTags.size !== result.data.results.length
      ) {
        additionalErrors.push(semantic.uniqueResultTags[lang]);
      }
      if (new Set(result.data.results.map((item) => item.id)).size !== result.data.results.length) {
        additionalErrors.push(semantic.uniqueResultIds[lang]);
      }
      // Recopilar todos los tags de las opciones
      const allTags = new Set<string>();
      result.data.questions.forEach((q, index) => {
        const invalid = q.options.some(
          (o) =>
            !o.personality_tags?.length || o.personality_tags.some((tag) => !resultTags.has(tag))
        );
        if (invalid) additionalErrors.push(semantic.existingResultTags(index)[lang]);
        q.options.forEach((o) => o.personality_tags?.forEach((tag) => allTags.add(tag)));
      });

      // Verificar que cada resultado tenga un tag válido
      result.data.results.forEach((r, index) => {
        if (r.personality_tag && !allTags.has(r.personality_tag)) {
          additionalErrors.push(semantic.unusedResultTag(index, r.personality_tag)[lang]);
        }
      });
    }
  }

  if (additionalErrors.length > 0) {
    return { valid: false, errors: additionalErrors };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida una pregunta individual
 */
export function validateQuestion(data: unknown): ValidationResult {
  const result = QuestionSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida un resultado de personality quiz
 */
export function validatePersonalityResult(data: unknown): ValidationResult {
  const result = PersonalityResultSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida la respuesta cruda del generador AI antes de servirla al cliente.
 * Aplica el schema estructural y encima las reglas semánticas del tipo de quiz.
 */
export function validateAIQuizResponse(
  data: unknown,
  quizType: 'trivia' | 'personality'
): ValidationResult {
  const result = AIQuizResponseSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
    );
    return { valid: false, errors };
  }

  const additionalErrors: string[] = [];

  // Para trivia: cada pregunta debe tener exactamente una respuesta correcta
  if (quizType === 'trivia') {
    result.data.questions.forEach((q, index) => {
      const correctOptions = q.options.filter((o) => o.is_correct === true);
      if (correctOptions.length !== 1) {
        additionalErrors.push(
          `Pregunta ${index + 1}: debe tener exactamente una respuesta correcta (tiene ${correctOptions.length})`
        );
      }
    });
  }

  // Para personality: el schema exige 3-8 resultados cuando existen; aquí se exige que existan
  if (quizType === 'personality' && !result.data.results?.length) {
    additionalErrors.push('Los quizzes de personalidad deben tener resultados definidos');
  }

  if (additionalErrors.length > 0) {
    return { valid: false, errors: additionalErrors };
  }

  return { valid: true, errors: [] };
}
