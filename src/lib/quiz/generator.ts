/**
 * Generador de Quizzes con AI (Groq API)
 * Usa Llama 3.3 70B para generar quizzes rápidos y baratos
 */

import type { QuizType, Difficulty } from '@/types/database';

// ============================================
// CONFIGURACIÓN
// ============================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODEL = 'llama-3.3-70b-versatile';

// ============================================
// PROMPT TEMPLATES
// ============================================

function createSystemPrompt(): string {
  return `You are a quiz creator for QuizVerse, a global quiz platform.
Your task is to create engaging, high-quality quizzes that users will love to play and share.

IMPORTANT RULES:
1. Write ONLY valid JSON, no markdown, no explanations
2. All text must be in the language requested
3. Make questions clear and unambiguous
4. For trivia: ensure exactly ONE correct answer per question
5. For personality: distribute personality_tags evenly across options
6. Make results distinct and meaningful

The JSON must follow this exact schema.`;
}

function createUserPrompt(params: GenerateQuizParams): string {
  return `Generate a ${params.quiz_type} quiz about "${params.topic}".

Requirements:
- Exactly ${params.num_questions} questions (default: 10)
- Language: ${params.language}
- Difficulty: ${params.difficulty}
- Each question has exactly 4 options
- For trivia: mark exactly one correct answer per question
- For personality: assign personality_tags to each option
- Include a brief explanation for each correct answer (trivia only)
- Generate ${params.num_results || 4} possible results with titles and descriptions

Respond ONLY with valid JSON matching this schema:

{
  "title": "string (catchy, SEO-friendly, max 80 chars)",
  "description": "string (compelling, max 200 chars)",
  "questions": [{
    "id": "q1",
    "question": "string",
    "options": [{
      "id": "a",
      "text": "string",
      "is_correct": boolean,
      "personality_tags": ["string"]
    }],
    "explanation": "string or null"
  }],
  "results": [{
    "id": "r1",
    "title": "string",
    "description": "string (2-3 sentences)",
    "personality_tag": "string or null",
    "background_theme": "fire|ice|stars|ocean|forest|mystic"
  }],
  "tags": ["string"],
  "estimated_minutes": number
}`;
}

// ============================================
// TIPOS
// ============================================

interface GenerateQuizParams {
  topic: string;
  quiz_type: QuizType;
  difficulty: Difficulty;
  num_questions: number;
  num_results?: number;
  language: string;
}

interface AIQuizResponse {
  title: string;
  description: string;
  questions: Array<{
    id: string;
    question: string;
    options: Array<{
      id: string;
      text: string;
      is_correct?: boolean;
      personality_tags?: string[];
    }>;
    explanation?: string;
  }>;
  results?: Array<{
    id: string;
    title: string;
    description: string;
    personality_tag?: string;
    background_theme?: string;
  }>;
  tags: string[];
  estimated_minutes: number;
}

export interface GenerateQuizResult {
  success: boolean;
  data?: AIQuizResponse;
  error?: string;
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

/**
 * Genera un quiz usando Groq API
 */
export async function generateQuizWithAI(
  params: GenerateQuizParams,
  apiKey: string
): Promise<GenerateQuizResult> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: createSystemPrompt() },
          { role: 'user', content: createUserPrompt(params) },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated');
    }

    // Parsear el JSON response
    const quizData: AIQuizResponse = JSON.parse(content);

    // Validación básica de la estructura
    if (!quizData.title || !quizData.questions || quizData.questions.length === 0) {
      throw new Error('Generated quiz is invalid or incomplete');
    }

    return {
      success: true,
      data: quizData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// TRANSFORMADORES
// ============================================

/**
 * Transforma la respuesta de la AI al formato de la DB
 */
export function transformAIQuizToDB(
  aiData: AIQuizResponse,
  overrides: {
    slug: string;
    category_id?: string | null;
    creator_id?: string | null;
    language: string;
  }
) {
  return {
    title: aiData.title,
    slug: overrides.slug,
    description: aiData.description,
    quiz_type: 'trivia' as const, // Se determina externamente
    difficulty: 'medium' as const,
    language: overrides.language,
    category_id: overrides.category_id,
    creator_id: overrides.creator_id,
    questions: aiData.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        is_correct: o.is_correct,
        personality_tags: o.personality_tags,
      })),
      explanation: q.explanation || null,
    })),
    results:
      aiData.results?.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        personality_tag: r.personality_tag || null,
        background_theme: r.background_theme as
          | 'fire'
          | 'ice'
          | 'stars'
          | 'ocean'
          | 'forest'
          | 'mystic'
          | undefined,
      })) || null,
    tags: aiData.tags,
    estimated_minutes: aiData.estimated_minutes,
    is_ai_generated: true,
    status: 'published' as const,
  };
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Genera un slug único a partir del título
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/**
 * Calcula el costo estimado de generación (Groq pricing)
 * ~$0.002 por quiz generado
 */
export function estimateGenerationCost(tokenCount: number): number {
  const COST_PER_MILLION_TOKENS = 0.64; // Llama 3.3 70B pricing
  return (tokenCount / 1_000_000) * COST_PER_MILLION_TOKENS;
}
