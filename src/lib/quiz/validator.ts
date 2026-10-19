/**
 * Validador de estructura de Quiz usando Zod
 */

import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const OptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
  is_correct: z.boolean().optional(),
  personality_tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional().nullable(),
});

const QuestionSchema = z.object({
  id: z.string(),
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
  personality_tag: z.string().optional(),
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
  tags: z.array(z.string()).max(10).optional().default([]),
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
});

const AIQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(1000),
  options: z.array(AIOptionSchema).min(2).max(6),
  explanation: z.string().optional().nullable(),
});

const AIResultSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  personality_tag: z.string().optional().nullable(),
  background_theme: z.enum(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']).optional(),
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

/**
 * Valida un quiz completo
 */
export function validateQuiz(data: unknown): ValidationResult {
  const result = QuizCreateSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten().formErrors;
    return { valid: false, errors };
  }

  // Validaciones adicionales específicas
  const additionalErrors: string[] = [];

  // Para trivia: cada pregunta debe tener exactamente una respuesta correcta
  if (result.data.quiz_type === 'trivia') {
    result.data.questions.forEach((q, index) => {
      const correctOptions = q.options.filter((o) => o.is_correct === true);
      if (correctOptions.length !== 1) {
        additionalErrors.push(
          `Pregunta ${index + 1}: debe tener exactamente una respuesta correcta (tiene ${correctOptions.length})`
        );
      }
    });
  }

  // Para personality: debe tener resultados y los tags deben coincidir
  if (result.data.quiz_type === 'personality') {
    if (!result.data.results || result.data.results.length === 0) {
      additionalErrors.push('Los quizzes de personalidad deben tener resultados definidos');
    } else {
      // Recopilar todos los tags de las opciones
      const allTags = new Set<string>();
      result.data.questions.forEach((q) => {
        q.options.forEach((o) => {
          o.personality_tags?.forEach((tag) => allTags.add(tag));
        });
      });

      // Verificar que cada resultado tenga un tag válido
      result.data.results.forEach((r, index) => {
        if (r.personality_tag && !allTags.has(r.personality_tag)) {
          additionalErrors.push(
            `Resultado ${index + 1}: el tag "${r.personality_tag}" no se usa en ninguna opción`
          );
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
    const errors = result.error.flatten().formErrors;
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
    const errors = result.error.flatten().formErrors;
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
