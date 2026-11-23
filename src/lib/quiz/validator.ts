/**
 * Validador de estructura de Quiz usando Zod
 */

import { z } from 'zod';
import { locales } from '@/lib/i18n/dictionaries';

// ============================================
// SCHEMAS
// ============================================

export const OptionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(500),
  is_correct: z.boolean().optional(),
  personality_tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional().nullable(),
});

export const QuestionSchema = z.object({
  id: z.string().min(1).max(64),
  question: z.string().min(1).max(1000),
  image_url: z.string().url().optional().nullable(),
  options: z.array(OptionSchema).min(2).max(10),
  explanation: z.string().max(500).optional().nullable(),
  time_limit_seconds: z.number().min(5).max(300).optional().nullable(),
});

export const PersonalityResultSchema = z.object({
  id: z.string().min(1).max(64),
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
  // Mismo conjunto vigente que las rutas /[locale] y updateQuiz: un idioma
  // fuera del catálogo deja al quiz huérfano de las páginas por locale.
  language: z.enum(locales).default('en'),
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
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(500),
  is_correct: z.boolean().optional(),
  personality_tags: z.array(z.string()).optional(),
  image_url: z.string().url().optional().nullable(),
});

const AIQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  question: z.string().min(1).max(1000),
  options: z.array(AIOptionSchema).min(2).max(6),
  explanation: z.string().max(500).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  time_limit_seconds: z.number().min(5).max(300).optional().nullable(),
});

const AIResultSchema = z.object({
  id: z.string().min(1).max(64),
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
export type AIQuizResponse = z.infer<typeof AIQuizResponseSchema>;

// ============================================
// FUNCIONES DE VALIDACIÓN
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AIValidationResult extends ValidationResult {
  data?: AIQuizResponse;
}

// Errores semánticos, bilingües: `createQuiz` y `updateQuiz` los devuelven al
// formulario, que los muestra tal cual (ver `ActionFailure.error`). El locale
// es el `language` del quiz enviado, que los formularios fijan al locale de la UI.
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

// Errores estructurales (fallos del schema Zod), también bilingües y con el
// prefijo `ruta:` que creatorErrorTarget usa para ubicar el mensaje en su
// campo. Lo que Zod no sepa nombrar cae a un genérico localizado: nunca sale
// inglés crudo a la UI.
const structural = {
  es: {
    minChars: (n: number) => `debe tener al menos ${n} ${n === 1 ? 'carácter' : 'caracteres'}`,
    maxChars: (n: number) => `debe tener como máximo ${n} ${n === 1 ? 'carácter' : 'caracteres'}`,
    minItems: (n: number) => `debe tener al menos ${n} ${n === 1 ? 'elemento' : 'elementos'}`,
    maxItems: (n: number) => `debe tener como máximo ${n} ${n === 1 ? 'elemento' : 'elementos'}`,
    minNumber: (n: number) => `debe ser al menos ${n}`,
    maxNumber: (n: number) => `debe ser como máximo ${n}`,
    wrongType: 'falta o no tiene el tipo esperado',
    invalid: 'no es válido',
  },
  en: {
    minChars: (n: number) => `must have at least ${n} characters`,
    maxChars: (n: number) => `must have at most ${n} characters`,
    minItems: (n: number) => `must have at least ${n} items`,
    maxItems: (n: number) => `must have at most ${n} items`,
    minNumber: (n: number) => `must be at least ${n}`,
    maxNumber: (n: number) => `must be at most ${n}`,
    wrongType: 'is missing or has the wrong type',
    invalid: 'is not valid',
  },
} as const;

interface StructuralIssue {
  code: string;
  path: PropertyKey[];
  message: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  inclusive?: boolean;
}

function structuralMessage(issue: StructuralIssue, lang: 'es' | 'en'): string {
  const copy = structural[lang];
  const inclusive = issue.inclusive !== false;
  if (issue.code === 'too_small' && issue.minimum !== undefined && inclusive) {
    const minimum = Number(issue.minimum);
    if (issue.origin === 'string') return copy.minChars(minimum);
    if (issue.origin === 'array') return copy.minItems(minimum);
    return copy.minNumber(minimum);
  }
  if (issue.code === 'too_big' && issue.maximum !== undefined && inclusive) {
    const maximum = Number(issue.maximum);
    if (issue.origin === 'string') return copy.maxChars(maximum);
    if (issue.origin === 'array') return copy.maxItems(maximum);
    return copy.maxNumber(maximum);
  }
  if (issue.code === 'invalid_type') return copy.wrongType;
  return copy.invalid;
}

/**
 * Mensajes `ruta: error` localizados para un fallo de schema. Lo comparten
 * `validateQuiz`, `validateAIQuizResponse`, `createQuiz` y `updateQuiz`.
 */
export function localizedIssueMessages(
  error: { issues: StructuralIssue[] },
  locale: string
): string[] {
  const lang = locale === 'es' ? 'es' : 'en';
  return error.issues.map(
    (issue) => `${issue.path.join('.') || 'root'}: ${structuralMessage(issue, lang)}`
  );
}

/**
 * Reglas semánticas únicas para quizzes creados, editados o generados por IA:
 * IDs únicos, exactamente una opción correcta en trivia y grafo completo de
 * tags/resultados en personality.
 */
function validateQuizSemantics(
  quiz: {
    quiz_type: 'trivia' | 'personality';
    questions: QuestionInput[];
    results?: PersonalityResultInput[] | null;
  },
  lang: 'es' | 'en'
): string[] {
  const errors: string[] = [];

  if (new Set(quiz.questions.map((question) => question.id)).size !== quiz.questions.length) {
    errors.push(semantic.uniqueQuestionIds[lang]);
  }

  quiz.questions.forEach((question, index) => {
    if (new Set(question.options.map((option) => option.id)).size !== question.options.length) {
      errors.push(semantic.uniqueOptionIds(index)[lang]);
    }
  });

  if (quiz.quiz_type === 'trivia') {
    quiz.questions.forEach((question, index) => {
      const correctOptions = question.options.filter((option) => option.is_correct === true);
      if (correctOptions.length !== 1) {
        errors.push(semantic.singleCorrectOption(index, correctOptions.length)[lang]);
      }
    });
  }

  if (quiz.quiz_type === 'personality') {
    if (!quiz.results || quiz.results.length === 0) {
      errors.push(semantic.resultsRequired[lang]);
    } else {
      const normalizedTags = quiz.results.map((item) => item.personality_tag?.trim() ?? '');
      const resultTags = new Set(normalizedTags);
      if (resultTags.has('') || resultTags.size !== quiz.results.length) {
        errors.push(semantic.uniqueResultTags[lang]);
      }
      if (new Set(quiz.results.map((item) => item.id)).size !== quiz.results.length) {
        errors.push(semantic.uniqueResultIds[lang]);
      }

      const allTags = new Set<string>();
      quiz.questions.forEach((question, index) => {
        const invalid = question.options.some((option) => {
          const optionTags = option.personality_tags?.map((tag) => tag.trim()).filter(Boolean);
          return !optionTags?.length || optionTags.some((tag) => !resultTags.has(tag));
        });
        if (invalid) errors.push(semantic.existingResultTags(index)[lang]);
        question.options.forEach((option) =>
          option.personality_tags?.forEach((tag) => {
            const trimmed = tag.trim();
            if (trimmed) allTags.add(trimmed);
          })
        );
      });

      quiz.results.forEach((item, index) => {
        const tag = item.personality_tag?.trim();
        if (tag && !allTags.has(tag)) {
          errors.push(semantic.unusedResultTag(index, tag)[lang]);
        }
      });
    }
  }

  return errors;
}

/**
 * Valida un quiz completo. `locale` decide el idioma de los errores semánticos
 * porque el caller los muestra al usuario final.
 */
export function validateQuiz(data: unknown, locale: string = 'es'): ValidationResult {
  const lang = locale === 'es' ? 'es' : 'en';
  const result = QuizCreateSchema.safeParse(data);

  if (!result.success) {
    return { valid: false, errors: localizedIssueMessages(result.error, locale) };
  }

  const additionalErrors = validateQuizSemantics(result.data, lang);
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
 * Devuelve únicamente el objeto parseado por Zod (sin campos extra) y aplica
 * las mismas reglas semánticas que el guardado en `validateQuiz`.
 */
export function validateAIQuizResponse(
  data: unknown,
  quizType: 'trivia' | 'personality',
  locale: string = 'es'
): AIValidationResult {
  const lang = locale === 'es' ? 'es' : 'en';
  const result = AIQuizResponseSchema.safeParse(data);

  if (!result.success) {
    return { valid: false, errors: localizedIssueMessages(result.error, lang) };
  }

  const additionalErrors = validateQuizSemantics(
    {
      quiz_type: quizType,
      questions: result.data.questions,
      results: result.data.results,
    },
    lang
  );

  if (additionalErrors.length > 0) {
    return { valid: false, errors: additionalErrors };
  }

  return { valid: true, errors: [], data: result.data };
}
