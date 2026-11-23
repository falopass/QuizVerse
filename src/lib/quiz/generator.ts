/**
 * Generador de Quizzes con AI (DeepSeek API)
 * Usa `deepseek-flash` en modo sin razonamiento y salida JSON estricta.
 */

import type { QuizType, Difficulty } from '@/types/database';

// ============================================
// CONFIGURACIÓN
// ============================================

export const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export const DEEPSEEK_MODEL = 'deepseek-flash';

export const DEFAULT_GENERATION_TIMEOUT_MS = 30_000;

const MAX_TOKENS = 4000;

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
5. For personality: every result must have a unique non-empty personality_tag, every option must reference at least one result's personality_tag, and every result tag must be used by at least one option
6. Make results distinct and meaningful

The JSON must follow this exact schema.`;
}

function createUserPrompt(params: GenerateQuizParams): string {
  return `Generate a ${params.quiz_type} quiz about "${params.topic}".

Requirements:
- Exactly ${params.num_questions} questions (default: 10)
- Language: ${params.language}
- Difficulty: ${params.difficulty}
- Each question has exactly 4 options with unique IDs
- For trivia: mark exactly one correct answer per question
- For personality: assign matching personality_tags from results to every option
- Include a brief explanation for each correct answer (trivia only)
- For personality: generate ${params.num_results || 4} possible results with unique IDs, unique non-empty personality_tag, titles, and descriptions

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
    "personality_tag": "string (required for personality, null for trivia)",
    "background_theme": "fire|ice|stars|ocean|forest|mystic"
  }],
  "tags": ["string"],
  "estimated_minutes": number
}`;
}

// ============================================
// TIPOS
// ============================================

export interface GenerateQuizParams {
  topic: string;
  quiz_type: QuizType;
  difficulty: Difficulty;
  num_questions: number;
  num_results?: number;
  language: string;
}

export interface GenerateQuizOptions {
  timeoutMs?: number;
}

export type GenerationFailureCode =
  | 'timeout'
  | 'truncated'
  | 'provider_rate_limited'
  | 'provider_error'
  | 'empty_response'
  | 'invalid_json';

export interface GenerationMetrics {
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
}

export interface GenerateQuizResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: GenerationFailureCode;
  httpStatus?: number;
  metrics?: GenerationMetrics;
}

interface DeepSeekCompletionPayload {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
  error?: {
    message?: string;
  };
}

function asTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function buildMetrics(
  startedAt: number,
  payload?: DeepSeekCompletionPayload | null
): GenerationMetrics {
  const usage = payload?.usage;
  const finishReason = payload?.choices?.[0]?.finish_reason;
  return {
    model: DEEPSEEK_MODEL,
    latencyMs: Math.max(0, Date.now() - startedAt),
    promptTokens: asTokenCount(usage?.prompt_tokens),
    completionTokens: asTokenCount(usage?.completion_tokens),
    totalTokens: asTokenCount(usage?.total_tokens),
    finishReason: typeof finishReason === 'string' ? finishReason : null,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

/**
 * Genera un quiz usando DeepSeek (`deepseek-flash`, sin razonamiento, salida JSON).
 * Aplica deadline por AbortController y reporta métricas de latencia/tokens sin
 * incluir prompts ni datos del usuario.
 */
export async function generateQuizWithAI(
  params: GenerateQuizParams,
  apiKey: string,
  options?: GenerateQuizOptions
): Promise<GenerateQuizResult> {
  const startedAt = Date.now();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: createSystemPrompt() },
          { role: 'user', content: createUserPrompt(params) },
        ],
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
      }),
    });

    if (!response.ok) {
      const errorData = (await response
        .json()
        .catch(() => null)) as DeepSeekCompletionPayload | null;
      const metrics = buildMetrics(startedAt, errorData);
      if (response.status === 429) {
        return {
          success: false,
          errorCode: 'provider_rate_limited',
          httpStatus: response.status,
          error: 'Provider rate limit exceeded',
          metrics,
        };
      }
      return {
        success: false,
        errorCode: 'provider_error',
        httpStatus: response.status,
        error: `Provider HTTP ${response.status}`,
        metrics,
      };
    }

    const payload = (await response.json().catch(() => null)) as DeepSeekCompletionPayload | null;
    const metrics = buildMetrics(startedAt, payload);
    const choice = payload?.choices?.[0];
    const finishReason = choice?.finish_reason ?? null;
    const content = choice?.message?.content;

    if (finishReason === 'length') {
      return {
        success: false,
        errorCode: 'truncated',
        error: 'Generated response was truncated by token limit',
        metrics,
      };
    }

    if (!content) {
      return {
        success: false,
        errorCode: 'empty_response',
        error: 'No content generated',
        metrics,
      };
    }

    let quizData: unknown;
    try {
      quizData = JSON.parse(content);
    } catch {
      return {
        success: false,
        errorCode: 'invalid_json',
        error: 'Generated content is not valid JSON',
        metrics,
      };
    }

    return {
      success: true,
      data: quizData,
      metrics,
    };
  } catch (error) {
    const metrics = buildMetrics(startedAt);
    if (isAbortError(error)) {
      return {
        success: false,
        errorCode: 'timeout',
        error: 'Generation request timed out',
        metrics,
      };
    }
    return {
      success: false,
      errorCode: 'provider_error',
      error: 'Provider request failed',
      metrics,
    };
  } finally {
    clearTimeout(timer);
  }
}
