import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DEEPSEEK_MODEL,
  generateQuizWithAI,
  type GenerationFailureCode,
} from '@/lib/quiz/generator';
import { validateAIQuizResponse } from '@/lib/quiz/validator';
import { inferVisualProfile } from '@/lib/design/visual-profile';
import { locales } from '@/lib/i18n/dictionaries';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { createClient } from '@/lib/supabase/server';

const generateQuizSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  quiz_type: z.enum(['trivia', 'personality']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  num_questions: z.number().int().min(3).max(20),
  language: z.enum(locales).default('en'),
});

const DEFAULT_DAILY_GLOBAL_LIMIT = 200;
const DEFAULT_DAILY_USER_LIMIT = 20;
const DAY_WINDOW_SECONDS = 86_400;

function getRequestIdentifier(request: NextRequest) {
  return clientIpFromHeaders(request.headers, 'anonymous');
}

function parseNonNegativeIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Each call burns paid DeepSeek tokens: 10/min per IP and 10/min per user, fail closed. */
const generateIpLimiter = createRateLimiter('quiz-generate-ip', 10, 60, 'closed');
const generateUserLimiter = createRateLimiter('quiz-generate-user', 10, 60, 'closed');

function mapProviderFailure(errorCode?: GenerationFailureCode): {
  status: number;
  error: string;
} {
  switch (errorCode) {
    case 'timeout':
      return { status: 504, error: 'generation_timeout' };
    case 'truncated':
      return { status: 502, error: 'generation_truncated' };
    case 'provider_rate_limited':
      return { status: 503, error: 'provider_quota_exceeded' };
    default:
      return { status: 502, error: 'generation_failed' };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = generateQuizSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekApiKey) {
    console.error('[quiz/generate] missing provider API key configuration');
    return NextResponse.json({ error: 'provider_misconfigured' }, { status: 500 });
  }

  const dailyGlobalLimit = parseNonNegativeIntEnv(
    'DEEPSEEK_DAILY_LIMIT',
    DEFAULT_DAILY_GLOBAL_LIMIT
  );
  const dailyUserLimit = parseNonNegativeIntEnv(
    'DEEPSEEK_USER_DAILY_LIMIT',
    DEFAULT_DAILY_USER_LIMIT
  );

  // Tope 0 actúa como apagado explícito del presupuesto diario sin tocar el resto del sitio.
  if (dailyGlobalLimit === 0 || dailyUserLimit === 0) {
    return NextResponse.json(
      {
        error: 'daily_quota_exceeded',
        rateLimit: { allowed: false, remaining: 0, reset: DAY_WINDOW_SECONDS },
      },
      { status: 429 }
    );
  }

  const day = utcDayKey();
  const dailyGlobalLimiter = createRateLimiter(
    'quiz-generate-daily-global',
    dailyGlobalLimit,
    DAY_WINDOW_SECONDS,
    'closed'
  );
  const dailyUserLimiter = createRateLimiter(
    'quiz-generate-daily-user',
    dailyUserLimit,
    DAY_WINDOW_SECONDS,
    'closed'
  );

  const ip = getRequestIdentifier(request);
  const dailyGlobalKey = `global:${day}`;
  const dailyUserKey = `${user.id}:${day}`;

  // Peek primero en las cuatro cuotas: una rechazada nunca debe consumir las demás.
  const [ipPeek, userPeek, dailyUserPeek, dailyGlobalPeek] = await Promise.all([
    generateIpLimiter.check(ip, { record: false }),
    generateUserLimiter.check(user.id, { record: false }),
    dailyUserLimiter.check(dailyUserKey, { record: false }),
    dailyGlobalLimiter.check(dailyGlobalKey, { record: false }),
  ]);

  const peeks = [ipPeek, userPeek, dailyUserPeek, dailyGlobalPeek];
  const peek = peeks.reduce((lowest, item) => (item.remaining < lowest.remaining ? item : lowest));

  if (peeks.some((item) => item.errored)) {
    return NextResponse.json(
      { error: 'rate_limiter_unavailable', rateLimit: peek },
      { status: 503 }
    );
  }

  if (!dailyGlobalPeek.allowed || !dailyUserPeek.allowed) {
    const dailyRateLimit =
      dailyGlobalPeek.remaining <= dailyUserPeek.remaining ? dailyGlobalPeek : dailyUserPeek;
    return NextResponse.json(
      { error: 'daily_quota_exceeded', rateLimit: dailyRateLimit },
      { status: 429 }
    );
  }

  if (!ipPeek.allowed || !userPeek.allowed) {
    const shortRateLimit = ipPeek.remaining <= userPeek.remaining ? ipPeek : userPeek;
    return NextResponse.json({ error: 'rate_limited', rateLimit: shortRateLimit }, { status: 429 });
  }

  // Todas las cuotas pasaron: ahora se registra el consumo antes de invocar al proveedor.
  const [ipLimit, userLimit, dailyUserLimitResult, dailyGlobalLimitResult] = await Promise.all([
    generateIpLimiter.check(ip),
    generateUserLimiter.check(user.id),
    dailyUserLimiter.check(dailyUserKey),
    dailyGlobalLimiter.check(dailyGlobalKey),
  ]);

  const limits = [ipLimit, userLimit, dailyUserLimitResult, dailyGlobalLimitResult];
  const rateLimit = limits.reduce((lowest, item) =>
    item.remaining < lowest.remaining ? item : lowest
  );

  if (limits.some((item) => item.errored)) {
    return NextResponse.json({ error: 'rate_limiter_unavailable', rateLimit }, { status: 503 });
  }

  if (!dailyGlobalLimitResult.allowed || !dailyUserLimitResult.allowed) {
    const dailyRateLimit =
      dailyGlobalLimitResult.remaining <= dailyUserLimitResult.remaining
        ? dailyGlobalLimitResult
        : dailyUserLimitResult;
    return NextResponse.json(
      { error: 'daily_quota_exceeded', rateLimit: dailyRateLimit },
      { status: 429 }
    );
  }

  if (!ipLimit.allowed || !userLimit.allowed) {
    const shortRateLimit = ipLimit.remaining <= userLimit.remaining ? ipLimit : userLimit;
    return NextResponse.json({ error: 'rate_limited', rateLimit: shortRateLimit }, { status: 429 });
  }

  const result = await generateQuizWithAI(parsed.data, deepseekApiKey);
  const telemetry = {
    model: result.metrics?.model ?? DEEPSEEK_MODEL,
    quizType: parsed.data.quiz_type,
    difficulty: parsed.data.difficulty,
    language: parsed.data.language,
    requestedQuestions: parsed.data.num_questions,
    latencyMs: result.metrics?.latencyMs ?? null,
    promptTokens: result.metrics?.promptTokens ?? null,
    completionTokens: result.metrics?.completionTokens ?? null,
    totalTokens: result.metrics?.totalTokens ?? null,
    finishReason: result.metrics?.finishReason ?? null,
  };

  if (!result.success || result.data === undefined) {
    const mapped = mapProviderFailure(result.errorCode);
    // Solo telemetría operativa: nunca registrar topic, prompt, PII ni errores crudos del proveedor.
    console.error('[quiz/generate] provider failed', {
      ...telemetry,
      errorCode: result.errorCode ?? 'provider_error',
      httpStatus: result.httpStatus ?? null,
    });
    return NextResponse.json({ error: mapped.error, rateLimit }, { status: mapped.status });
  }

  const aiValidation = validateAIQuizResponse(
    result.data,
    parsed.data.quiz_type,
    parsed.data.language
  );

  if (!aiValidation.valid || !aiValidation.data) {
    console.error('[quiz/generate] AI returned an invalid quiz', {
      ...telemetry,
      errorCount: aiValidation.errors.length,
    });
    return NextResponse.json({ error: 'invalid_generated_quiz', rateLimit }, { status: 502 });
  }

  const parsedQuiz = aiValidation.data;
  // Telemetría operativa sin prompts ni PII (latencia, modelo y consumo de tokens).
  // eslint-disable-next-line no-console
  console.info('[quiz/generate] completed', {
    ...telemetry,
    generatedQuestions: parsedQuiz.questions.length,
  });

  const validationWarnings: string[] = [];

  if (parsedQuiz.questions.length !== parsed.data.num_questions) {
    validationWarnings.push(
      parsed.data.language === 'es'
        ? 'La IA generó una cantidad de preguntas distinta de la pedida.'
        : 'The AI generated a different number of questions than requested.'
    );
  }

  return NextResponse.json({
    quiz: {
      ...parsedQuiz,
      quiz_type: parsed.data.quiz_type,
      difficulty: parsed.data.difficulty,
      language: parsed.data.language,
      visual_profile: inferVisualProfile({
        title: parsedQuiz.title,
        description: parsedQuiz.description,
        quiz_type: parsed.data.quiz_type,
        tags: parsedQuiz.tags,
        category: null,
        language: parsed.data.language,
      }),
    },
    validationWarnings,
    rateLimit,
    sourceLanguage: parsed.data.language,
  });
}
