/**
 * Generador de Quizzes con AI (DeepSeek API)
 * Usa deepseek-chat para generar quizzes rápidos y baratos
 */

import type { QuizType, Difficulty } from '@/types/database';

// ============================================
// CONFIGURACIÓN
// ============================================

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const MODEL = 'deepseek-chat';

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
    const response = await fetch(DEEPSEEK_API_URL, {
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
      throw new Error(errorData.error?.message || `DeepSeek API error: ${response.status}`);
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
