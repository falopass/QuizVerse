import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQuizWithAI } from '@/lib/quiz/generator';
import { validateAIQuizResponse } from '@/lib/quiz/validator';
import { inferVisualProfile } from '@/lib/design/visual-profile';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { createClient } from '@/lib/supabase/server';

const generateQuizSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  quiz_type: z.enum(['trivia', 'personality']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  num_questions: z.number().int().min(3).max(20),
  language: z.string().trim().min(2).max(10).default('en'),
});

function getRequestIdentifier(request: NextRequest) {
  return clientIpFromHeaders(request.headers, 'anonymous');
}

/** Each call burns paid DeepSeek tokens: 10/min per IP and 10/min per user, fail closed. */
const generateIpLimiter = createRateLimiter('quiz-generate-ip', 10, 60, 'closed');
const generateUserLimiter = createRateLimiter('quiz-generate-user', 10, 60, 'closed');

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
    console.error('[quiz/generate] missing DEEPSEEK_API_KEY server configuration');
    return NextResponse.json({ error: 'provider_misconfigured' }, { status: 500 });
  }

  const ip = getRequestIdentifier(request);
  // Peek primero: una cuota rechazada no debe consumir la otra.
  const [ipPeek, userPeek] = await Promise.all([
    generateIpLimiter.check(ip, { record: false }),
    generateUserLimiter.check(user.id, { record: false }),
  ]);
  const peek = ipPeek.remaining <= userPeek.remaining ? ipPeek : userPeek;

  if (ipPeek.errored || userPeek.errored) {
    return NextResponse.json(
      { error: 'rate_limiter_unavailable', rateLimit: peek },
      { status: 503 }
    );
  }

  if (!ipPeek.allowed || !userPeek.allowed) {
    return NextResponse.json({ error: 'rate_limited', rateLimit: peek }, { status: 429 });
  }

  // Ambas cuotas pasaron: ahora sí se registra el consumo en las dos.
  const [ipLimit, userLimit] = await Promise.all([
    generateIpLimiter.check(ip),
    generateUserLimiter.check(user.id),
  ]);
  const rateLimit = ipLimit.remaining <= userLimit.remaining ? ipLimit : userLimit;

  if (ipLimit.errored || userLimit.errored) {
    return NextResponse.json({ error: 'rate_limiter_unavailable', rateLimit }, { status: 503 });
  }

  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: 'rate_limited', rateLimit }, { status: 429 });
  }

  const result = await generateQuizWithAI(parsed.data, deepseekApiKey);

  if (!result.success || !result.data) {
    // El texto del proveedor (DeepSeek) es diagnóstico interno: al cliente va
    // un código estable que la UI traduce a un mensaje accionable.
    console.error('[quiz/generate] provider failed', {
      topic: parsed.data.topic,
      error: result.error,
    });
    return NextResponse.json({ error: 'generation_failed', rateLimit }, { status: 502 });
  }

  const aiValidation = validateAIQuizResponse(result.data, parsed.data.quiz_type);

  if (!aiValidation.valid) {
    console.error('[quiz/generate] AI returned an invalid quiz', {
      topic: parsed.data.topic,
      quizType: parsed.data.quiz_type,
      errors: aiValidation.errors,
    });
    return NextResponse.json({ error: 'invalid_generated_quiz', rateLimit }, { status: 502 });
  }

  const validationWarnings: string[] = [];

  if (result.data.questions.length !== parsed.data.num_questions) {
    validationWarnings.push(
      parsed.data.language === 'es'
        ? 'La IA generó una cantidad de preguntas distinta de la pedida.'
        : 'The AI generated a different number of questions than requested.'
    );
  }

  return NextResponse.json({
    quiz: {
      ...result.data,
      quiz_type: parsed.data.quiz_type,
      difficulty: parsed.data.difficulty,
      language: parsed.data.language,
      visual_profile: inferVisualProfile({
        title: result.data.title,
        description: result.data.description,
        quiz_type: parsed.data.quiz_type,
        tags: result.data.tags ?? [],
        category: null,
        language: parsed.data.language,
      }),
    },
    validationWarnings,
    rateLimit,
    sourceLanguage: parsed.data.language,
  });
}
